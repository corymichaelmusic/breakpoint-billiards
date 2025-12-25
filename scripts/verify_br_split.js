
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verifySplit() {
    await client.connect();
    try {
        console.log("Verifying B&R Split...");
        const res = await client.query(`
            SELECT 
                winner_id,
                game_type,
                COUNT(*) as br_count
            FROM games 
            WHERE is_break_and_run = true
            GROUP BY winner_id, game_type
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

verifySplit();
