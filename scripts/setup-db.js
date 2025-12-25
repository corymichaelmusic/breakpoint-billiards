const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function setupDatabase() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const schemaPath = path.join(__dirname, '../supabase/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema...');
        await client.query(schemaSql);
        console.log('Schema executed successfully');

    } catch (err) {
        console.error('Error executing schema:', err);
    } finally {
        await client.end();
    }
}

setupDatabase();
