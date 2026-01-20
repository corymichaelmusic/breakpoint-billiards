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

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        const matchId = '9ec68e45-6021-4166-a895-30f299e3ee72'; // ID from inspect_debug
        const gameType = '8ball';

        console.log(`Attempting manual reset for match ${matchId} (${gameType})...`);

        await client.query('BEGIN');

        // Call RPC
        const res = await client.query(`SELECT reset_match_stats($1, $2)`, [matchId, gameType]);
        console.log("RPC Result:", res.rows);

        // Verify Deletion
        const check = await client.query(`SELECT count(*) FROM games WHERE match_id = $1 AND game_type = $2`, [matchId, '8ball']);
        console.log("Remaining 8-ball games:", check.rows[0].count);

        // Verify Status Reset
        const matchCheck = await client.query(`SELECT status_8ball, score_8ball_p1 FROM matches WHERE id = $1`, [matchId]);
        console.log("Match Status:", matchCheck.rows[0]);

        await client.query('COMMIT');
        console.log("Commit successful.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error (Rolled back):", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
