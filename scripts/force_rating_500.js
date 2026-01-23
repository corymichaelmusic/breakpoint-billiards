const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function forceRatings() {
    console.log("Forcing all Breakpoint Ratings to 500 (Level 5.0)...");

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Update Profiles
        console.log("Updating Profiles...");
        await client.query(`UPDATE profiles SET breakpoint_rating = 500;`);

        // 2. Update League Players
        console.log("Updating League Players...");
        await client.query(`UPDATE league_players SET breakpoint_rating = 500;`);

        console.log("✅ All ratings set to 500.");

    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        await client.end();
    }
}

forceRatings();
