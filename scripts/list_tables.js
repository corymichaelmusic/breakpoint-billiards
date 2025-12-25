const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function listTables() {
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);
        console.log("Tables:", res.rows.map(r => r.table_name));
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

listTables();
