const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
    const sql = fs.readFileSync(
        path.resolve(__dirname, '../supabase/set_primary_session.sql'),
        'utf8'
    );

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    try {
        await client.query(sql);
        console.log('Applied set_primary_session RPC.');
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('Failed to apply set_primary_session RPC:', error);
    process.exit(1);
});
