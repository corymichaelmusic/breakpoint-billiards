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

        // Add player_number column if not exists
        await client.query(`
            ALTER TABLE public.profiles 
            ADD COLUMN IF NOT EXISTS player_number SERIAL;
        `);
        console.log('Added player_number column');

        // Set sequence to start at 10000 (if safe)
        // Check current max to be safe, but mostly fine for new feature.
        // We use setval('profiles_player_number_seq', GREATEST(10000, (SELECT MAX(player_number) FROM profiles)));
        // Actually, since we just added it and populated it (SERIAL fills existing with 1..N), we should check.
        // If we just added it, existing rows got 1, 2, 3...
        // We probably want to update existing rows to be 10000+?
        // Let's just set the sequence for FUTURE rows.
        await client.query(`
            SELECT setval(pg_get_serial_sequence('profiles', 'player_number'), GREATEST(10001, (SELECT COALESCE(MAX(player_number), 0) FROM profiles) + 1));
        `);
        console.log('Updated sequence to start at 10001+');

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
