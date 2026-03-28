const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const michaelId = 'user_38xbqBHx2bj8x2YO9FF5LwYQgTa';
    
    // Find Spring 2026 session
    const { data: league } = await supabase.from('leagues').select('id, name').ilike('name', '%Spring 2026%').single();
    if (!league) {
        console.log("Spring 2026 league not found");
        return;
    }
    console.log("Checking Michael's stats for:", league.name, "(" + league.id + ")");

    const { data: lp, error } = await supabase.from('league_players').select('*').eq('player_id', michaelId).eq('league_id', league.id).single();
    if (error) {
        console.error("Error fetching league_player:", error);
        return;
    }
    
    if (lp) {
        console.log("Matches Won:", lp.matches_won);
        console.log("Matches Played:", lp.matches_played);
        console.log("Matches Lost:", lp.matches_lost);
        console.log("Wait, does it have matches_lost column explicitly? Let's check keys...");
        console.log("Record Keys:", Object.keys(lp).join(", "));
        console.log("FULL RECORD:", JSON.stringify(lp, null, 2));
    } else {
        console.log("No record found for Michael in this league");
    }
}
run();
