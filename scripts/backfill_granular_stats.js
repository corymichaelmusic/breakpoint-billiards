
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function backfill() {
    await client.connect();
    try {
        console.log("Backfilling Granular Stats...");

        // 1. Reset counts (Optional, but safe)
        await client.query(`
            UPDATE league_players 
            SET total_break_and_runs = 0,
                total_rack_and_runs = 0,
                total_nine_on_snap = 0,
                total_win_zip = 0,
                total_early_8 = 0
        `);

        // 2. Aggregate stats from games table (Split by Game Type)
        const res = await client.query(`
            SELECT 
                g.winner_id,
                m.league_id,
                g.game_type,
                COUNT(*) FILTER (WHERE g.is_break_and_run) as break_runs,
                COUNT(*) FILTER (WHERE g.is_rack_and_run) as rack_runs,
                COUNT(*) FILTER (WHERE g.is_9_on_snap) as snaps,
                COUNT(*) FILTER (WHERE g.is_win_zip) as win_zips,
                COUNT(*) FILTER (WHERE g.is_early_8) as early_8s
            FROM games g
            JOIN matches m ON g.match_id = m.id
            WHERE g.winner_id IS NOT NULL
            GROUP BY g.winner_id, m.league_id, g.game_type
        `);

        // We need to merge by player/league to update a single row
        const updates = {}; // { "playerId_leagueId": { br8: 0, br9: 0, ... } }

        for (const row of res.rows) {
            const key = `${row.winner_id}_${row.league_id}`;
            if (!updates[key]) {
                updates[key] = {
                    pid: row.winner_id,
                    lid: row.league_id,
                    br8: 0, br9: 0,
                    rr8: 0, rr9: 0,
                    wz8: 0, wz9: 0,
                    snap: 0, e8: 0
                };
            }

            const u = updates[key];
            if (row.game_type === '8ball') {
                u.br8 += parseInt(row.break_runs);
                u.rr8 += parseInt(row.rack_runs);
                u.wz8 += parseInt(row.win_zips);
                u.e8 += parseInt(row.early_8s); // 8-ball specific
            } else {
                u.br9 += parseInt(row.break_runs);
                u.rr9 += parseInt(row.rack_runs);
                u.wz9 += parseInt(row.win_zips);
                u.snap += parseInt(row.snaps); // 9-ball specific
            }
        }

        for (const key in updates) {
            const u = updates[key];
            console.log(`Updating Player ${u.pid}: Br8=${u.br8}, Br9=${u.br9}`);

            await client.query(`
                UPDATE league_players
                SET total_break_and_runs_8ball = $1,
                    total_break_and_runs_9ball = $2,
                    total_rack_and_runs_8ball = $3,
                    total_rack_and_runs_9ball = $4,
                    total_win_zip_8ball = $5,
                    total_win_zip_9ball = $6,
                    total_nine_on_snap = $7,
                    total_early_8 = $8,
                    
                    -- Also update merged for safety/legacy (optional)
                    total_break_and_runs = $1::int + $2::int,
                    total_rack_and_runs = $3::int + $4::int,
                    total_win_zip = $5::int + $6::int
                    
                WHERE player_id = $9 AND league_id = $10
            `, [
                u.br8, u.br9,
                u.rr8, u.rr9,
                u.wz8, u.wz9,
                u.snap, u.e8,
                u.pid, u.lid
            ]);
        }

        console.log("Backfill Complete.");

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

backfill();
