const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9'; // Cory Michael

async function debugMembership() {
    console.log(`Checking membership for user: ${USER_ID}`);

    // 1. Get all league_players entries
    const { data: memberships, error } = await supabase
        .from("league_players")
        .select(`
            status,
            joined_at,
            league_id,
            leagues (
                id,
                name,
                type,
                status
            )
        `)
        .eq("player_id", USER_ID);

    if (error) {
        console.error("Error fetching memberships:", error);
        return;
    }

    console.log(`Found ${memberships.length} memberships:`);
    memberships.forEach(m => {
        console.log(`- League: ${m.leagues?.name} (${m.leagues?.type})`);
        console.log(`  League Status: ${m.leagues?.status}`);
        console.log(`  Player Status: ${m.status}`);
        console.log(`  Joined At: ${m.joined_at}`);
        console.log(`  League ID: ${m.league_id}`);
        console.log('---');
    });

    // 2. Simulate the Dashboard Query
    const { data: orgMembership } = await supabase
        .from("league_players")
        .select("status, leagues!inner(type)")
        .eq("player_id", USER_ID)
        .eq("leagues.type", "league")
        .maybeSingle();

    console.log("Dashboard Org Query Result:", orgMembership);

    const { data: sessionMemberships } = await supabase
        .from("league_players")
        .select("league_id, status, payment_status, leagues!inner(id, name, type, status)")
        .eq("player_id", USER_ID)
        .eq("leagues.type", "session")
        .in("leagues.status", ["setup", "active", "completed"])
        .order("joined_at", { ascending: false });

    console.log("Dashboard Session Query Result:", sessionMemberships?.length || 0, "sessions found.");
}

debugMembership();
