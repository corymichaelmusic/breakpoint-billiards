
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    await client.connect();
    try {
        console.log("--- League Players Stats ---");
        const res = await client.query(`
            SELECT player_id, breakpoint_rating, matches_played, matches_won, breakpoint_racks_won, breakpoint_racks_played 
            FROM league_players
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

inspect();
