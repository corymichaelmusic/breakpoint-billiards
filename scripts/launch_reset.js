const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function launchReset() {
    console.log("🚀 INITIATING LAUNCH RESET (Rating 5.0, Clear Stats)...");

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Delete all Game records
        console.log("1️⃣  Deleting all games...");
        await client.query(`DELETE FROM games;`);

        // 2. Reset all Matches to scheduled
        console.log("2️⃣  Resetting all matches to scheduled...");
        await client.query(`
            UPDATE matches
            SET 
                status_8ball = 'scheduled',
                status_9ball = 'scheduled',
                winner_id = NULL,
                winner_id_8ball = NULL,
                winner_id_9ball = NULL,
                points_8ball_p1 = 0, points_8ball_p2 = 0,
                points_9ball_p1 = 0, points_9ball_p2 = 0,
                score_8ball_p1 = 0, score_8ball_p2 = 0,
                score_9ball_p1 = 0, score_9ball_p2 = 0,
                delta_8ball_p1 = NULL, delta_8ball_p2 = NULL,
                delta_9ball_p1 = NULL, delta_9ball_p2 = NULL,
                current_points_p1 = 0, current_points_p2 = 0,
                p1_break_run_8ball = false, p2_break_run_8ball = false,
                p1_rack_run_8ball = false, p2_rack_run_8ball = false,
                p1_break_run_9ball = false, p2_break_run_9ball = false,
                p1_nine_on_snap = false, p2_nine_on_snap = false,
                submitted_at = NULL,
                verification_status = 'pending',
                pending_p1_submission = NULL,
                pending_p2_submission = NULL,
                p1_submitted_at = NULL,
                p2_submitted_at = NULL,
                auto_submit_deadline = NULL,
                is_forfeit = false
        `);

        // 3. Reset League Players Stats
        console.log("3️⃣  Clearing League Player stats...");
        await client.query(`
            UPDATE league_players
            SET 
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

        // 4. Reset Profiles Ratings to 5.0 (500)
        console.log("4️⃣  Resetting Global Profile ratings to 5.0 (500)...");
        await client.query(`
            UPDATE profiles
            SET 
                breakpoint_rating = 500,
                fargo_rating = 500 -- Reset legacy fargo just in case
        `);

        // 5. Verification
        console.log("\n🔍 VERIFICATION:");

        const gamesCount = await client.query('SELECT COUNT(*) FROM games');
        console.log(`   Games Count: ${gamesCount.rows[0].count} (Should be 0)`);

        const matchStatusCount = await client.query("SELECT COUNT(*) FROM matches WHERE status_8ball != 'scheduled' OR status_9ball != 'scheduled'");
        console.log(`   Non-Scheduled Matches: ${matchStatusCount.rows[0].count} (Should be 0)`);

        const profileRatingCount = await client.query("SELECT COUNT(*) FROM profiles WHERE breakpoint_rating != 500");
        console.log(`   Profiles != 5.0: ${profileRatingCount.rows[0].count} (Should be 0)`);

        const leagueStatsCount = await client.query("SELECT COUNT(*) FROM league_players WHERE matches_played > 0 OR breakpoint_racks_played > 0");
        console.log(`   League Players with Stats: ${leagueStatsCount.rows[0].count} (Should be 0)`);

        console.log("\n✅ LAUNCH RESET COMPLETE.");

    } catch (e) {
        console.error("❌ Reset Error:", e);
    } finally {
        await client.end();
    }
}

launchReset();
