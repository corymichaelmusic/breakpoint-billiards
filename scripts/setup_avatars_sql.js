const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runAvatarSetup() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to Database. Reading SQL file...");

        const sqlPath = path.join(__dirname, '../supabase/setup_avatars_bucket.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Executing SQL...");
        await client.query(sql);
        console.log("Success! Avatar bucket and policies set up.");

    } catch (err) {
        console.error("Error executing SQL:", err);
    } finally {
        await client.end();
    }
}

runAvatarSetup();
