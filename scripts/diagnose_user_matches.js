
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function diagnose() {
    console.log("Diagnosing recent matches (JSON)...");
    if (!dbUrl) {
        console.error("DATABASE_URL not found.");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();

        const res = await client.query(`
            SELECT 
                id, 
                scheduled_date, 
                status, 
                status_8ball, 
                status_9ball, 
                race_8ball_p1, 
                race_9ball_p1
            FROM matches 
            WHERE status != 'finalized'
            ORDER BY scheduled_date ASC
            LIMIT 10
        `);

        console.log(JSON.stringify(res.rows, null, 2));

    } catch (e) {
        console.error("Diagnosis Error:", e);
    } finally {
        await client.end();
    }
}

diagnose();
