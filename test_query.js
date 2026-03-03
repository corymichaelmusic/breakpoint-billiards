require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
    const playerId = '08e063f9-71c1-4ba2-afd1-5d46bb2d35af';
    const leagueId = '341cdb33-eadd-4db0-bb6d-bd4bffd81c03';

    // Same query as stats-actions
    let matchesQuery = supabase
        .from("matches")
        .select("id, player1_id, player2_id, winner_id, status_8ball, status_9ball, league_id, leagues!inner(parent_league_id, id)")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .eq("league_id", leagueId);

    const { data, error } = await matchesQuery;
    console.log("Match count:", data?.length);
    if(error) console.error("Error:", error);
}

run();
