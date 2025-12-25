
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

const matchId = '97c95516-8af4-4191-9792-90befb0e18a9';

async function runFix() {
    console.log(`Cleaning verification for match ${matchId}...`);
    if (!dbUrl) {
        console.error("DATABASE_URL not found.");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();

        await client.query(`
            UPDATE matches 
            SET 
                p1_verified = false,
                p2_verified = false,
                winner_id = NULL
            WHERE id = $1
        `, [matchId]);

        console.log("Match cleaned.");

    } catch (e) {
        console.error("Fix Error:", e);
    } finally {
        await client.end();
    }
}

runFix();
