
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspectPoints() {
    await client.connect();
    try {
        console.log("Checking Recent Finalized Games Points...");
        const res = await client.query(`
            SELECT id, created_at, status, status_8ball, status_9ball, 
                   points_8ball_p1, points_8ball_p2,
                   points_9ball_p1, points_9ball_p2
            FROM matches 
            WHERE status_8ball = 'finalized' OR status_9ball = 'finalized'
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

inspectPoints();
