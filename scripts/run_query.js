const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const query = process.argv[2];
        if (!query) {
            console.error("Usage: node scripts/run_query.js 'SELECT ...'");
            process.exit(1);
        }
        const res = await client.query(query);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

run();
