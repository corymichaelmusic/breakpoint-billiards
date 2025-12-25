const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function fixStorage() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const sqlPath = path.join(__dirname, '../supabase/fix_storage_owner_type.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Executing SQL to alter storage.objects.owner...");
        await client.query(sql);
        console.log("Success! Column type altered.");

    } catch (err) {
        console.error("Error executing SQL:", err);
    } finally {
        await client.end();
    }
}

fixStorage();
