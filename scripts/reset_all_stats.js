const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function resetAllStats() {
    console.log("INITIALIZING FULL STATS RESET (Keeping Leagues/Players)...");

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Delete all Game records
        console.log("Deleting all games...");
        await client.query(`DELETE FROM games;`);

        // 2. Reset all Matches to scheduled
        console.log("Resetting all matches to scheduled...");
        await client.query(`
            UPDATE matches
            SET 
                status_8ball = 'scheduled',
                status_9ball = 'scheduled',
                winner_id_8ball = NULL,
                winner_id_9ball = NULL,
                points_8ball_p1 = 0, points_8ball_p2 = 0,
                points_9ball_p1 = 0, points_9ball_p2 = 0,
                score_8ball_p1 = 0, score_8ball_p2 = 0,
                score_9ball_p1 = 0, score_9ball_p2 = 0,
                delta_8ball_p1 = NULL, delta_8ball_p2 = NULL,
                delta_9ball_p1 = NULL, delta_9ball_p2 = NULL,
                p1_break_run_8ball = false, p2_break_run_8ball = false,
                p1_rack_run_8ball = false, p2_rack_run_8ball = false,
                p1_break_run_9ball = false, p2_break_run_9ball = false,
                p1_nine_on_snap = false, p2_nine_on_snap = false,
                submitted_at = NULL,
                verification_status = 'in_progress', -- Verified valid status
                pending_p1_submission = NULL,
                pending_p2_submission = NULL,
                p1_submitted_at = NULL,
                p2_submitted_at = NULL,
                auto_submit_deadline = NULL
        `);

        // 3. Reset League Players Stats
        console.log("Resetting League Player stats...");
        await client.query(`
            UPDATE league_players
            SET 
                breakpoint_rating = 500,
                breakpoint_racks_played = 0,
                breakpoint_racks_won = 0,
                breakpoint_racks_lost = 0,
                matches_played = 0,
                matches_won = 0,
                matches_lost = 0,
                shutouts = 0,
                total_break_and_runs = 0,
                total_rack_and_runs = 0,
                total_nine_on_snap = 0,
                total_early_8 = 0,
                total_break_and_runs_8ball = 0,
                total_break_and_runs_9ball = 0,
                total_rack_and_runs_8ball = 0,
                total_rack_and_runs_9ball = 0
        `);

        // 4. Reset Profiles Ratings
        console.log("Resetting Global Profile ratings...");
        // Reset to Fargo Rating if available, else 500
        await client.query(`
            UPDATE profiles
            SET breakpoint_rating = COALESCE(fargo_rating, 500)
        `);

        console.log("✅ FULL STATS RESET COMPLETE.");

    } catch (e) {
        console.error("❌ Reset Error:", e);
    } finally {
        await client.end();
    }
}

resetAllStats();
