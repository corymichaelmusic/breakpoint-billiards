const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config();
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        console.log("Starting Global Stats Audit...");

        // Fetch all league players
        const playersRes = await client.query('SELECT player_id, league_id, breakpoint_racks_played FROM league_players');
        const players = playersRes.rows;

        console.log(`Auditing ${players.length} player records...`);
        let fixedCount = 0;

        for (const p of players) {
            // Count actual games played in this league
            const countRes = await client.query(`
                SELECT count(g.id) 
                FROM games g
                JOIN matches m ON g.match_id = m.id
                WHERE m.league_id = $1 
                  AND (m.player1_id = $2 OR m.player2_id = $2)
            `, [p.league_id, p.player_id]);

            const actualCount = parseInt(countRes.rows[0].count);

            if (actualCount !== p.breakpoint_racks_played) {
                console.log(`Mismatch found for ${p.player_id} (League ${p.league_id}): stored ${p.breakpoint_racks_played}, actual ${actualCount}. FIXING...`);

                // Perform Repair (only racks_played for now to be safe, but ideally should do all)
                // Reusing logic from repair_stats.js: recalculate racks_won/lost too!

                const winRes = await client.query(`
                    SELECT count(g.id) 
                    FROM games g
                    JOIN matches m ON g.match_id = m.id
                    WHERE m.league_id = $1 AND g.winner_id = $2
                `, [p.league_id, p.player_id]);
                const actualWins = parseInt(winRes.rows[0].count);
                const actualLosses = actualCount - actualWins;

                // Count granular stats
                const statsRes = await client.query(`
                    SELECT 
                        count(*) FILTER (WHERE is_break_and_run) as break_runs,
                        count(*) FILTER (WHERE is_rack_and_run) as rack_runs,
                        count(*) FILTER (WHERE is_9_on_snap) as snaps,
                        count(*) FILTER (WHERE is_early_8) as early8
                    FROM games g
                    JOIN matches m ON g.match_id = m.id
                    WHERE m.league_id = $1 AND g.winner_id = $2
                `, [p.league_id, p.player_id]);
                const stats = statsRes.rows[0];

                await client.query(`
                    UPDATE league_players
                    SET 
                        breakpoint_racks_played = $3,
                        breakpoint_racks_won = $4,
                        breakpoint_racks_lost = $5,
                        total_break_and_runs = $6,
                        total_rack_and_runs = $7,
                        total_nine_on_snap = $8,
                        total_early_8 = $9
                    WHERE player_id = $1 AND league_id = $2
                `, [
                    p.player_id, p.league_id,
                    actualCount,
                    actualWins,
                    actualLosses,
                    stats.break_runs || 0,
                    stats.rack_runs || 0,
                    stats.snaps || 0,
                    stats.early8 || 0
                ]);

                fixedCount++;
            }
        }

        console.log(`Audit Complete. Fixed ${fixedCount} corrupted records.`);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
