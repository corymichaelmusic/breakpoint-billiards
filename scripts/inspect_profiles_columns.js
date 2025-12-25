const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function inspectProfiles() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'profiles';
        `);
        console.log("Profiles Columns:", res.rows.map(r => r.column_name));

        // Also check one row to see sample data
        const sample = await client.query('SELECT * FROM profiles LIMIT 1');
        console.log("Sample Profile:", sample.rows[0]);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspectProfiles();
