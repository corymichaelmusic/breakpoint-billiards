const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function runPg() {
    const sqlFile = process.argv[2];
    if (!sqlFile) {
        console.error("Usage: node scripts/run_sql.js <path_to_sql_file>");
        process.exit(1);
    }

    console.log('Connecting to database...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const fullPath = path.resolve(sqlFile);
        console.log(`Reading SQL from ${fullPath}...`);
        const sql = fs.readFileSync(fullPath, 'utf8');

        console.log('Executing SQL...');
        await client.query(sql);
        console.log('SQL executed successfully.');
    } catch (err) {
        console.error('PG Error:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runPg();
