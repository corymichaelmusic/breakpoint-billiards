const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Check the match we tested in test_rpc_v2.js
        const matchId = 'f3c79c95-6bb9-42af-96b0-e43685912fc6'; // The ID from previous output

        const res = await client.query(`
            SELECT id, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball 
            FROM matches 
            WHERE id = $1
        `, [matchId]);

        if (res.rows.length > 0) {
            console.log("Match Status:", res.rows[0]);
        } else {
            console.log("Match not found (maybe it was a different db?)");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

run();
