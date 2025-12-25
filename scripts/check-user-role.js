const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function runPg() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query('SELECT id, email, role, operator_status FROM profiles WHERE id = $1', [USER_ID]);
        console.table(res.rows);
    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

runPg();
