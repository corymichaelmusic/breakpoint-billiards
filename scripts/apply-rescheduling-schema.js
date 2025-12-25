const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runPg() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const sqlPath = path.join(__dirname, '../supabase/update_schema_rescheduling.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon, but be careful about semicolons in strings (unlikely here)
        const statements = sql.split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            await client.query(statement);
        }

        console.log('Schema updated successfully via PG client.');
    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

runPg();
