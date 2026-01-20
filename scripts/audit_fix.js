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
        const playersRes = await client.query('SELECT player_id, league_id, breakpoint_racks_played, matches_played, matches_won, shutouts FROM league_players');
        const players = playersRes.rows;

        console.log(`Auditing ${players.length} player records...`);
        let fixedCount = 0;

        for (const p of players) {
            // 1. Count Racks (Games Table)
            // ---------------------------------------------------------
            const countRes = await client.query(`
                SELECT count(g.id) 
                FROM games g
                JOIN matches m ON g.match_id = m.id
                WHERE m.league_id = $1 
                  AND (m.player1_id = $2 OR m.player2_id = $2)
            `, [p.league_id, p.player_id]);

            const actualRacksPlayed = parseInt(countRes.rows[0].count);

            // 2. Count Matches/Sets (Matches Table)
            // ---------------------------------------------------------
            // A "Match" in stats = A finalized Set (8ball OR 9ball)
            const matchRes = await client.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE status_8ball = 'finalized') as m8,
                    COUNT(*) FILTER (WHERE status_9ball = 'finalized') as m9,
                    COUNT(*) FILTER (WHERE winner_id_8ball = $2) as w8,
                    COUNT(*) FILTER (WHERE winner_id_9ball = $2) as w9
                FROM matches
                WHERE league_id = $1 AND (player1_id = $2 OR player2_id = $2)
            `, [p.league_id, p.player_id]);

            const mr = matchRes.rows[0];
            const actualMatchesPlayed = parseInt(mr.m8 || 0) + parseInt(mr.m9 || 0);
            const actualMatchesWon = parseInt(mr.w8 || 0) + parseInt(mr.w9 || 0);
            const actualMatchesLost = actualMatchesPlayed - actualMatchesWon;

            // 3. Count Shutouts
            // Defined as winning BOTH 8-ball and 9-ball in the same match
            const shutoutRes = await client.query(`
                SELECT count(id) 
                FROM matches
                WHERE league_id = $1 
                  AND status_8ball = 'finalized' 
                  AND status_9ball = 'finalized'
                  AND winner_id_8ball = $2
                  AND winner_id_9ball = $2
            `, [p.league_id, p.player_id]);
            const actualShutouts = parseInt(shutoutRes.rows[0].count);


            // Check for Mismatch (Racks OR Matches OR Shutouts)
            if (actualRacksPlayed !== p.breakpoint_racks_played ||
                actualMatchesPlayed !== p.matches_played ||
                actualMatchesWon !== p.matches_won ||
                actualShutouts !== (p.shutouts || 0)) {

                console.log(`Mismatch for ${p.player_id} (League ${p.league_id}):`);
                console.log(`  Racks: Stored ${p.breakpoint_racks_played} vs Actual ${actualRacksPlayed}`);
                console.log(`  Matches: Stored ${p.matches_played} vs Actual ${actualMatchesPlayed}`);
                console.log(`  Shutouts: Stored ${p.shutouts || 0} vs Actual ${actualShutouts}`);
                console.log("  FIXING...");

                // Calc Wins/Losses for Racks
                const winRes = await client.query(`
                    SELECT count(g.id) 
                    FROM games g
                    JOIN matches m ON g.match_id = m.id
                    WHERE m.league_id = $1 AND g.winner_id = $2
                `, [p.league_id, p.player_id]);
                const actualRacksWon = parseInt(winRes.rows[0].count);
                const actualRacksLost = actualRacksPlayed - actualRacksWon;

                // Calc Granular Stats
                const statsRes = await client.query(`
                    SELECT 
                        count(*) FILTER (WHERE is_break_and_run) as break_runs,
                        count(*) FILTER (WHERE is_rack_and_run) as rack_runs,
                        count(*) FILTER (WHERE is_9_on_snap) as snaps,
                        count(*) FILTER (WHERE is_early_8) as early8,
                        count(*) FILTER (WHERE game_type='8ball' AND is_break_and_run) as br8,
                        count(*) FILTER (WHERE game_type='8ball' AND is_rack_and_run) as rr8,
                        count(*) FILTER (WHERE game_type='9ball' AND is_break_and_run) as br9
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
                        matches_played = $6,
                        matches_won = $7,
                        matches_lost = $8,
                        shutouts = $9,
                        total_break_and_runs = $10,
                        total_rack_and_runs = $11,
                        total_nine_on_snap = $12,
                        total_early_8 = $13,
                        total_break_and_runs_8ball = $14,
                        total_rack_and_runs_8ball = $15,
                        total_break_and_runs_9ball = $16
                    WHERE player_id = $1 AND league_id = $2
                `, [
                    p.player_id, p.league_id,
                    actualRacksPlayed,
                    actualRacksWon,
                    actualRacksLost,
                    actualMatchesPlayed, // Matches
                    actualMatchesWon,
                    actualMatchesLost,
                    actualShutouts, // Shutouts
                    stats.break_runs || 0,
                    stats.rack_runs || 0,
                    stats.snaps || 0,
                    stats.early8 || 0,
                    stats.br8 || 0,
                    stats.rr8 || 0,
                    stats.br9 || 0
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
