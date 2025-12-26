const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function traceStats() {
    console.log("--- 1. Finding Player 'Cory' ---");
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', '%Cory%')
        .limit(1);

    if (pError || !profiles || profiles.length === 0) {
        console.error("Player not found:", pError);
        return;
    }

    const player = profiles[0];
    const playerId = player.id;
    console.log(`Found Player: ${player.full_name} (${playerId})`);

    console.log("\n--- 2. Running Matches Query (Mimic stats-actions.ts) ---");
    // .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    // .or("status.eq.finalized,winner_id.not.is.null");

    const { data: matches, error: mError } = await supabase
        .from("matches")
        .select("id, status, winner_id, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .or("status.eq.finalized,winner_id.not.is.null");

    if (mError) {
        console.error("Query Error:", mError);
    } else {
        console.log(`Query returned ${matches.length} matches.`);
        if (matches.length > 0) {
            console.log("Sample Match:", matches[0]);
        }
    }

    console.log("\n--- 3. Checking ALL matches for player (ignoring status filter) ---");
    const { data: allMatches } = await supabase
        .from("matches")
        .select("id, status, winner_id")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);

    console.log(`Total Matches (Raw): ${allMatches.length}`);
    if (allMatches.length > 0) {
        const statuses = [...new Set(allMatches.map(m => m.status))];
        console.log("Statuses found:", statuses);
    }
}

traceStats();
