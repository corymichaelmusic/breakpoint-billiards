const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function promoteUser() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const headers = {
        'x-client-info': 'supabase-js-web/2.43.4'
    }

    try {
        await client.connect();

        const userId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

        const res = await client.query(`
            UPDATE profiles 
            SET role = 'operator', operator_status = 'approved'
            WHERE id = $1
            RETURNING id, full_name, role, operator_status;
        `, [userId]);

        console.log("Updated Profile:", res.rows[0]);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

promoteUser();
