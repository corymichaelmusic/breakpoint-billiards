require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function finalReset() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const matchId = '94e22009-210b-4713-991e-89322f3a1dbd';

        await client.query("UPDATE matches SET scheduled_date = '2026-02-09' WHERE id = $1", [matchId]);
        await client.query("DELETE FROM dismissed_reminders WHERE match_id = $1", [matchId]);

        console.log('Final Reset successful: Match set to Feb 9th and dismissals cleared.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

finalReset();
