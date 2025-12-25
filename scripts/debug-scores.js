const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const res = await client.query(`
            SELECT id, current_points_p1, current_points_p2, winner_id 
            FROM matches 
            WHERE status = 'finalized' 
            LIMIT 10
        `);

        console.table(res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
