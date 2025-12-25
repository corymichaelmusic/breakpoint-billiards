const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function debugRequests() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT match_id, count(*) 
            FROM reschedule_requests 
            GROUP BY match_id 
            HAVING count(*) > 1;
        `);

        console.log("Matches with duplicate requests:", res.rows);

        const all = await client.query('SELECT * FROM reschedule_requests ORDER BY created_at DESC LIMIT 10');
        console.log("Recent Requests:", all.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

debugRequests();
