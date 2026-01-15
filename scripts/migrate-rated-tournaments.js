
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected. Starting Rated Tournaments migration...');
        await client.query('BEGIN');

        // 1. Add is_rated to tournaments
        console.log('Adding is_rated to tournaments...');
        await client.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_rated BOOLEAN DEFAULT FALSE;`);

        // 2. Modify matches table
        console.log('Modifying matches table...');

        // 2a. Make league_id nullable
        // Check if constraint exists or just alter column
        await client.query(`ALTER TABLE matches ALTER COLUMN league_id DROP NOT NULL;`);

        // 2b. Add tournament_id
        await client.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;`);

        // 2c. Add index for performance
        await client.query(`CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);`);

        await client.query('COMMIT');
        console.log('Migration successful! ✅');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed ❌', e);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
