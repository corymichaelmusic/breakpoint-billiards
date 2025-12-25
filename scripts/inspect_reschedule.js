
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function run() {
    if (!dbUrl) {
        console.error("DATABASE_URL not found.");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });
    const sqlPath = path.join(__dirname, '../supabase/check_ratings.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        await client.connect();
        const res = await client.query(sql);
        console.log("Policies:", res.rows);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}
run();
