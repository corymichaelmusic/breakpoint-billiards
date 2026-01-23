
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function resetStats() {
    if (!process.env.DATABASE_URL) {
        console.error("Error: DATABASE_URL not found in .env.local");
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const targetIds = [
            'user_38V0g7fCDSUhqvq7RiwpoDkI6W0', // Faithe
            'user_38GKAWlAxWgwMuoirhNpUxHRwWM'  // Cory 2
        ];

        // 1. Reset League Players
        console.log("Resetting league_players...");
        const lpRes = await client.query(`
            UPDATE public.league_players
            SET 
                breakpoint_rating = 500,
                breakpoint_confidence = 0,
                breakpoint_racks_played = 0,
                matches_played = 0,
                matches_won = 0,
                matches_lost = 0,
                breakpoint_racks_won = 0,
                breakpoint_racks_lost = 0,
                total_break_and_runs = 0,
                total_rack_and_runs = 0,
                total_nine_on_snap = 0,
                total_early_8 = 0,
                total_break_and_runs_8ball = 0,
                total_break_and_runs_9ball = 0,
                total_rack_and_runs_8ball = 0,
                total_rack_and_runs_9ball = 0,
                shutouts = 0
            WHERE player_id = ANY($1)
            RETURNING id, player_id, breakpoint_rating;
        `, [targetIds]);
        console.log("Updated LPs:", lpRes.rows);

        // 2. Reset Profiles
        console.log("Resetting profiles...");
        const pRes = await client.query(`
            UPDATE public.profiles
            SET breakpoint_rating = 500
            WHERE id = ANY($1)
            RETURNING id, full_name, breakpoint_rating;
        `, [targetIds]);
        console.log("Updated Profiles:", pRes.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

resetStats();
