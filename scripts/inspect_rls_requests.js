
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function inspectPolicies() {
    console.log('Inspecting RLS Policies for reschedule_requests...');
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT policyname, cmd, qual, with_check
            FROM pg_policies
            WHERE tablename = 'reschedule_requests';
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

inspectPolicies();
