
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    await client.connect();
    try {
        console.log("--- Recent Games (Data Check) ---");
        // Check if we captured 'how' it was won
        const games = await client.query(`
            SELECT id, game_type, winner_id, is_break_and_run, is_rack_and_run, is_9_on_snap, is_win_zip 
            FROM games 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        console.table(games.rows);

        console.log("\n--- League Players Columns (Schema Check) ---");
        const columns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'league_players'
        `);
        console.log(columns.rows.map(r => r.column_name).join(', '));

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

inspect();
