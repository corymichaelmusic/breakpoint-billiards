const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    console.log("--- Checking Profiles Schema ---");
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(3);

    if (error) {
        console.error("Error fetching profiles:", error);
        return;
    }

    if (profiles.length > 0) {
        const p = profiles[0];
        console.log("Columns found:", Object.keys(p));
        console.log("Sample Player Number:", p.player_number);
        console.log("Sample Confidence:", p.confidence_score);
        console.log("Sample Rating:", p.breakpoint_rating);
    } else {
        console.log("No profiles found.");
    }

    console.log("\n--- Checking Matches for a Player ---");
    // Just pick the first player found
    if (profiles.length > 0) {
        const pid = profiles[0].id;
        console.log(`Checking matches for player: ${profiles[0].full_name} (${pid})`);

        const { data: matches, error: mError } = await supabase
            .from('matches')
            .select('id, status, winner_id')
            .or(`player1_id.eq.${pid},player2_id.eq.${pid}`);

        if (mError) console.error("Error fetching matches:", mError);
        else {
            console.log(`Found ${matches.length} matches.`);
            console.log("Statuses:", matches.map(m => m.status));
        }
    }
}

inspect();
