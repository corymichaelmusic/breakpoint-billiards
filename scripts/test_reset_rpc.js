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

        const matchId = 'f3c79c95-6bb9-42af-96b0-e43685912fc6'; // Known finalized match
        console.log(`Attempting to reset match ${matchId} (8ball)...`);

        const res = await client.query(`
            SELECT reset_match_stats($1, $2);
        `, [matchId, '8ball']);

        console.log("✅ Reset RPC successful!", res.rows);

    } catch (err) {
        console.error("❌ Error running reset_match_stats:", err);
    } finally {
        await client.end();
    }
}

run();
