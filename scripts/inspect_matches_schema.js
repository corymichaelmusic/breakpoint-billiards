
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function inspectSchema() {
    if (!dbUrl) {
        console.error("DATABASE_URL not found.");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'matches';
        `);
        console.log("Schema for matches:");
        res.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type}`);
        });
    } catch (e) {
        console.error("Inspection Error:", e);
    } finally {
        await client.end();
    }
}

inspectSchema();
