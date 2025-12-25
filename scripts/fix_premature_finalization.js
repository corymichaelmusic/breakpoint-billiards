
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function runFix() {
    console.log("Checking for prematurely finalized matches (Attempt 2)...");
    if (!dbUrl) {
        console.error("DATABASE_URL not found.");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();

        // Find matches that are 'finalized' globally, 
        // BUT have a sub-status that is still 'scheduled' or 'in_progress'.
        // This handles cases where race data is NULL in DB.

        const res = await client.query(`
            SELECT id, status_8ball, status_9ball, scheduled_date 
            FROM matches 
            WHERE status = 'finalized'
            AND (
                status_8ball IN ('scheduled', 'in_progress')
                OR 
                status_9ball IN ('scheduled', 'in_progress')
            )
        `);

        if (res.rows.length === 0) {
            console.log("No prematurely finalized matches found.");
        } else {
            console.log(`Found ${res.rows.length} matches to fix.`);
            console.table(res.rows);

            const ids = res.rows.map(r => r.id);

            await client.query(`
                UPDATE matches 
                SET status = 'in_progress',
                    p1_verified = false,
                    p2_verified = false,
                    winner_id = NULL
                WHERE id = ANY($1::uuid[])
            `, [ids]);

            console.log("Fixed status for matches:", ids);
        }

    } catch (e) {
        console.error("Fix Error:", e);
    } finally {
        await client.end();
    }
}

runFix();
