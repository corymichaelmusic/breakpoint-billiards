const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log('Connected to DB');

        // 1. Shift existing IDs to 7-digit range (User requested 7 digits)
        // We'll base it on 1,000,000.
        // If an ID is already >= 1,000,000, leave it (prevent double migration).
        // If ID < 1,000,000, add 1,000,000.
        const res = await client.query(`
            UPDATE profiles 
            SET player_number = player_number + 1000000 
            WHERE player_number < 1000000;
        `);
        console.log(`Updated ${res.rowCount} existing profiles to 7-digit IDs.`);

        // 2. Update Sequence to start at next available 7-digit number
        // We set it to GREATEST(1000000, MAX(player_number)) + 1
        await client.query(`
            SELECT setval(pg_get_serial_sequence('profiles', 'player_number'), GREATEST(1000000, (SELECT COALESCE(MAX(player_number), 0) FROM profiles)) + 1);
        `);
        console.log('Updated sequence to continue from highest 7-digit ID.');

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
