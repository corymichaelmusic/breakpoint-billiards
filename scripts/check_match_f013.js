const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkMatch() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const matchId = 'f01359d6-4fed-4fc1-9645-a2ed9c542204';

        const res = await client.query(`
            SELECT id, status_8ball, points_8ball_p1, points_8ball_p2 
            FROM matches WHERE id = $1;
        `, [matchId]);

        console.log("Match Status:", res.rows[0]);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkMatch();
