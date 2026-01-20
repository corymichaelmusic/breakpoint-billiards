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
        const p1Id = 'user_38V3SHW8bD9FbFb8qJGyzLme7kM';
        const p2Id = 'user_38V8MV9EpEnIbKAeb6mOCjtrUHS';

        console.log("Checking League Players Stats...");
        const lpRes = await client.query(`
            SELECT player_id, breakpoint_racks_played 
            FROM league_players 
            WHERE player_id IN ($1, $2)
        `, [p1Id, p2Id]);

        console.table(lpRes.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
