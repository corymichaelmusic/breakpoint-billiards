const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function inspectPolicies() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'reschedule_requests';
        `);

        console.log("RLS Policies for reschedule_requests:");
        res.rows.forEach(r => {
            console.log(`- ${r.policyname} (${r.cmd}): ${r.qual}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspectPolicies();
