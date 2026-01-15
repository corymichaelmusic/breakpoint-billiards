
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const w = await client.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns 
        WHERE table_name = 'tournament_participants' AND column_name = 'id';
    `);
        console.log('tournament_participants.id type:', w.rows[0]);

        const m = await client.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns 
        WHERE table_name = 'tournament_matches' AND column_name = 'player1_id';
    `);
        console.log('tournament_matches.player1_id type:', m.rows[0]);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
