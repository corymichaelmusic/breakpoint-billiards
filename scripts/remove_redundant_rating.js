const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function removeRedundantRating() {
    console.log("REMOVING REDUNDANT breakpoint_rating FROM league_players...");

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Check if column exists
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='league_players' AND column_name='breakpoint_rating'
        `);

        if (res.rows.length === 0) {
            console.log("ℹ️ Column 'breakpoint_rating' does not exist in 'league_players'. Skipping.");
            return;
        }

        // 2. Drop dependent view
        console.log("Dropping dependent view 'v_league_players_visible'...");
        await client.query(`DROP VIEW IF EXISTS v_league_players_visible;`);

        // 3. Drop the column
        console.log("Dropping column 'breakpoint_rating' from 'league_players'...");
        await client.query(`ALTER TABLE league_players DROP COLUMN breakpoint_rating;`);

        console.log("✅ Column dropped successfully.");

        // 4. Recreate the view
        console.log("Recreating view 'v_league_players_visible'...");
        const createViewQuery = `
            CREATE VIEW v_league_players_visible AS
            SELECT 
                id,
                league_id,
                player_id,
                joined_at,
                status,
                payment_status,
                amount_paid,
                paid,
                -- breakpoint_rating removed
                breakpoint_confidence,
                breakpoint_racks_played,
                matches_played,
                matches_won,
                matches_lost,
                breakpoint_racks_won,
                breakpoint_racks_lost,
                total_break_and_runs,
                total_rack_and_runs,
                total_nine_on_snap,
                total_early_8,
                total_break_and_runs_8ball,
                total_break_and_runs_9ball,
                total_rack_and_runs_8ball,
                total_rack_and_runs_9ball,
                shutouts
            FROM get_league_players_visible(NULL::uuid);
        `;
        await client.query(createViewQuery);
        console.log("✅ View recreated successfully.");

    } catch (e) {
        console.error("❌ Error removing column:", e);
    } finally {
        await client.end();
    }
}

removeRedundantRating();
