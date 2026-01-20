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
        const p1Id = 'user_38V3jc7BblMLNW8oU6JLpYvbFY8';
        const p2Id = 'user_38V7Vlzg7uLY2ssFDXn1VE8he51';

        console.log("Checking Stats & Names...");

        // Join with profiles to get names
        const res = await client.query(`
            SELECT lp.player_id, lp.breakpoint_racks_played, p.full_name, p.email
            FROM league_players lp
            JOIN profiles p ON lp.player_id = p.id
            WHERE lp.player_id IN ($1, $2)
        `, [p1Id, p2Id]);

        console.table(res.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
