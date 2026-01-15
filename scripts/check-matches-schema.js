
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Check matches table columns and constraints
        const res = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'matches';
    `);
        console.log('Matches Table Columns:', res.rows.map(r => `${r.column_name} (${r.data_type}, ${r.is_nullable})`));

        // Check if league_id has a foreign key and if it's nullable
        const constraints = await client.query(`
        SELECT 
            tc.constraint_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.table_name = 'matches';
    `);
        console.log('Matches Constraints:', constraints.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
