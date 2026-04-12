const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const relativeFile = process.argv[2];

    if (!relativeFile) {
        console.error('Usage: node scripts/apply_sql_file.js <relative-sql-file>');
        process.exit(1);
    }

    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not found in .env.local');
        process.exit(1);
    }

    const absoluteFile = path.join(__dirname, '..', relativeFile);
    const sql = fs.readFileSync(absoluteFile, 'utf8');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log(`Applying ${relativeFile}...`);
        await client.query(sql);
        console.log(`Applied ${relativeFile} successfully.`);
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('Failed to apply SQL file:', error);
    process.exit(1);
});
