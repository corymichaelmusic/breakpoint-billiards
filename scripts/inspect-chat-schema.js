const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function inspectSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database. Inspecting chat_read_status...');

        const query = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'chat_read_status'
            AND table_schema = 'public'
            ORDER BY ordinal_position;
        `;

        const res = await client.query(query);
        console.log('Columns for chat_read_status:');
        console.table(res.rows);

        const policyQuery = `
            SELECT policyname, permissive, roles, cmd, qual, with_check
            FROM pg_policies
            WHERE tablename = 'chat_read_status';
        `;
        const policyRes = await client.query(policyQuery);
        console.log('Policies for chat_read_status:');
        console.table(policyRes.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

inspectSchema();
