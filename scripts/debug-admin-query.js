const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const OPERATOR_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing env vars:", { supabaseUrl, hasKey: !!supabaseServiceKey });
        return;
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // 1. Get League Org ID
    const { data: league } = await adminClient
        .from("leagues")
        .select("id")
        .eq("operator_id", OPERATOR_ID)
        .eq("type", "league")
        .single();

    if (!league) {
        console.error("League not found");
        return;
    }

    const leagueId = league.id;
    console.log("League ID:", leagueId);

    // 2. Get Sessions
    const { data: sessions } = await adminClient
        .from("leagues")
        .select("id")
        .eq("parent_league_id", leagueId);

    const sessionIds = sessions?.map(s => s.id) || [];
    const allLeagueIds = [leagueId, ...sessionIds];
    console.log("All League IDs:", allLeagueIds);

    // 3. Run the query exactly as in the page
    const { data: players, error } = await adminClient
        .from("league_players")
        .select("*, profiles(*), leagues(name)")
        .in("league_id", allLeagueIds)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Query Error:", error);
    } else {
        console.log("Players Found:", players.length);
        if (players.length > 0) {
            console.log("First player:", JSON.stringify(players[0], null, 2));
        }
    }
}

run();
