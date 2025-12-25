const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function resetDatabase() {
    console.log("INITIALIZING FULL DATABASE RESET...");

    if (!dbUrl) {
        console.error("DATABASE_URL not found.");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();

        // 0. Delete Dependencies
        console.log("Deleting Dependencies (Reschedules)...");
        await client.query(`DELETE FROM public.reschedule_requests;`);
        // Assuming notifications might also link to matches/games, safer to wipe them if we are doing a full reset


        // 1. Delete Games
        console.log("Deleting all GAMES...");
        await client.query(`DELETE FROM public.games;`);

        // 2. Delete Matches
        console.log("Deleting all MATCHES...");
        await client.query(`DELETE FROM public.matches;`);

        // 3. Delete League Sessions (Rows in leagues table with type='session')
        console.log("Deleting Session Players and Sessions...");

        // 3a. Delete Players linked to Sessions (to avoid FK error)
        // We want to keep players linked to the main 'league' (Organization), but delete those in 'session'
        await client.query(`
            DELETE FROM public.league_players 
            WHERE league_id IN (SELECT id FROM public.leagues WHERE type = 'session');
        `);

        // 3b. Delete the Sessions themselves
        await client.query(`DELETE FROM public.leagues WHERE type = 'session';`);

        // 4. Reset Stats for remaining (Organization) players
        console.log("Resetting PLAYER STATS (Organization level)...");
        await client.query(`
            UPDATE public.league_players
            SET 
                breakpoint_rating = 500,
                breakpoint_racks_played = 0,
                breakpoint_racks_won = 0,
                breakpoint_points = 0,
                games_played = 0,
                games_won = 0,
                win_percentage = 0
            WHERE 1=1;
        `);

        console.log("✅ FULL RESET COMPLETE.");

    } catch (e) {
        console.error("❌ Reset Error:", e);
        process.exit(1);
    } finally {
        await client.end();
    }
}

resetDatabase();
