
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function fixPrematureFinalization() {
    if (!process.env.DATABASE_URL) {
        console.error("Error: DATABASE_URL not found in .env.local");
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        const query = `
            UPDATE public.matches
            SET status_9ball = 'scheduled',
                winner_id_9ball = NULL,
                p1_verified_9ball = FALSE,
                p2_verified_9ball = FALSE
            WHERE status_9ball = 'finalized'
              AND points_9ball_p1 = 0
              AND points_9ball_p2 = 0;
        `;

        console.log("Executing fix...");
        const res = await client.query(query);
        console.log(`Fix executed. Updated ${res.rowCount} matches.`);

    } catch (err) {
        console.error("Error executing fix:", err);
    } finally {
        await client.end();
    }
}

fixPrematureFinalization();
