
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    await client.connect();
    try {
        console.log("--- Finalized Matches ---");
        const res = await client.query(`
            SELECT id, player1_id, player2_id, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball 
            FROM matches 
            WHERE status_8ball = 'finalized' OR status_9ball = 'finalized'
        `);
        console.table(res.rows);

        console.log("\n--- Player Stats (League Players) ---");
        const players = await client.query(`
            SELECT player_id, matches_played, matches_won, breakpoint_rating, breakpoint_racks_won 
            FROM league_players
        `);
        console.table(players.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

inspect();
