
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected. Starting migration (v3)...');
        await client.query('BEGIN');

        // 1. Participant Changes
        console.log('Updating participants table...');
        await client.query(`ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS guest_name TEXT;`);
        await client.query(`ALTER TABLE tournament_participants ALTER COLUMN player_id DROP NOT NULL;`);

        // 2. DROP OLD CONSTRAINTS
        console.log('Dropping old constraints...');
        await client.query(`ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_player1_id_fkey;`);
        await client.query(`ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_player2_id_fkey;`);
        await client.query(`ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_winner_id_fkey;`);

        // 3. Data Migration: Map Profile IDs (Text) to Participant IDs (UUID as Text)
        // We do this BEFORE altering types because 'user_...' is not a valid UUID.
        console.log('Migrating match data values (Text -> UUID Text)...');

        // Update Player 1
        // Only update if it looks like a Clerk ID or just matches a player_id
        await client.query(`
        UPDATE tournament_matches tm
        SET player1_id = tp.id::text
        FROM tournament_participants tp
        WHERE tm.tournament_id = tp.tournament_id 
          AND tp.player_id IS NOT NULL
          AND tm.player1_id = tp.player_id;
    `);

        // Update Player 2
        await client.query(`
        UPDATE tournament_matches tm
        SET player2_id = tp.id::text
        FROM tournament_participants tp
        WHERE tm.tournament_id = tp.tournament_id 
          AND tp.player_id IS NOT NULL
          AND tm.player2_id = tp.player_id;
    `);

        // Update Winner
        await client.query(`
        UPDATE tournament_matches tm
        SET winner_id = tp.id::text
        FROM tournament_participants tp
        WHERE tm.tournament_id = tp.tournament_id 
          AND tp.player_id IS NOT NULL
          AND tm.winner_id = tp.player_id;
    `);

        // 4. Change Match Column Types to UUID
        // Now that values are valid UUID strings (or NULL), this cast will succeed.
        console.log('Altering match columns to UUID...');
        await client.query(`ALTER TABLE tournament_matches ALTER COLUMN player1_id TYPE UUID USING player1_id::uuid;`);
        await client.query(`ALTER TABLE tournament_matches ALTER COLUMN player2_id TYPE UUID USING player2_id::uuid;`);
        await client.query(`ALTER TABLE tournament_matches ALTER COLUMN winner_id TYPE UUID USING winner_id::uuid;`);


        // 5. Add New Constraints
        console.log('Adding new FK constraints...');
        await client.query(`
        ALTER TABLE tournament_matches 
        ADD CONSTRAINT tournament_matches_player1_id_fkey 
        FOREIGN KEY (player1_id) REFERENCES tournament_participants(id);
    `);
        await client.query(`
        ALTER TABLE tournament_matches 
        ADD CONSTRAINT tournament_matches_player2_id_fkey 
        FOREIGN KEY (player2_id) REFERENCES tournament_participants(id);
    `);
        await client.query(`
        ALTER TABLE tournament_matches 
        ADD CONSTRAINT tournament_matches_winner_id_fkey 
        FOREIGN KEY (winner_id) REFERENCES tournament_participants(id);
    `);

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
