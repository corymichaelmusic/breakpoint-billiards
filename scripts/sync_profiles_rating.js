
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function sync() {
    await client.connect();
    try {
        console.log("Syncing Profiles Ratings...");

        // Fetch latest rating for each player from league_players
        // If a player is in multiple leagues, we might need logic (e.g. max, or most recent). 
        // For now, let's take the max rating to represent their "best" known capability, 
        // or just the most recently updated one.
        // Let's assume 1 active league for now.

        // Select MAX rating per player to avoid overwriting with defaults
        const playersStats = await client.query(`
            SELECT player_id, MAX(breakpoint_rating) as breakpoint_rating
            FROM league_players 
            WHERE breakpoint_rating IS NOT NULL
            GROUP BY player_id
        `);

        for (const p of playersStats.rows) {
            console.log(`Updating Profile for ${p.player_id}: ${p.breakpoint_rating}`);
            await client.query(`
                UPDATE profiles 
                SET breakpoint_rating = $1 
                WHERE id = $2
            `, [p.breakpoint_rating, p.player_id]);
        }

        console.log("Sync Complete.");

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

sync();
