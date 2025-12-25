require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function checkLatestMatch() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, created_at, coin_flip_winner_id, coin_flip_winner_id_9ball, player1_id, player2_id, status_8ball, status_9ball
            FROM matches
            ORDER BY created_at DESC
            LIMIT 1;
        `);

        if (res.rows.length === 0) {
            console.log("No matches found.");
        } else {
            console.log("Latest Match Data:", res.rows[0]);
        }
    } catch (err) {
        console.error("Error detecting match:", err);
    } finally {
        await client.end();
    }
}

checkLatestMatch();
