const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load .env.local if it exists
if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config();
}

console.log("Connecting to:", process.env.DATABASE_URL ? "Database URL found" : "NO DATABASE URL");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        console.log("Fetching latest modified match...");
        // Get the most recently modified match (or finalized)
        const res = await client.query(`
            SELECT id, status_8ball, player1_id, player2_id, 
                   score_8ball_p1, score_8ball_p2, 
                   delta_8ball_p1
            FROM matches 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log("No matches found.");
            return;
        }

        const match = res.rows[0];
        console.log("Latest Match:", match);

        // Count Games
        console.log(`Checking GAMES for match ${match.id}...`);
        const gamesRes = await client.query(`
            SELECT id, game_type, winner_id, is_break_and_run, is_rack_and_run 
            FROM games 
            WHERE match_id = $1
        `, [match.id]);

        console.log(`Found ${gamesRes.rows.length} games.`);
        console.table(gamesRes.rows);

        // Check Player Stats
        console.log("Checking League Players...");
        const lpRes = await client.query(`
            SELECT player_id, breakpoint_racks_played, total_break_and_runs, total_break_and_runs_8ball 
            FROM league_players 
            WHERE player_id IN ($1, $2)
        `, [match.player1_id, match.player2_id]);

        console.table(lpRes.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
