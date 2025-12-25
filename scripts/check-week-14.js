const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function checkWeek14() {
    // 1. Get active session
    const { data: memberships } = await supabase
        .from("league_players")
        .select("league_id, leagues!inner(id, name, status)")
        .eq("player_id", USER_ID)
        .eq("leagues.type", "session")
        .in("leagues.status", ["active", "setup"])
        .limit(1);

    if (!memberships || memberships.length === 0) {
        console.log("No active session found for user.");
        return;
    }

    const session = memberships[0].leagues;
    console.log(`Active Session: ${session.name} (${session.id})`);

    // 2. Get Week 14 matches
    const { data: matches } = await supabase
        .from("matches")
        .select("*")
        .eq("league_id", session.id)
        .eq("week_number", 14);

    console.log(`Found ${matches.length} matches for Week 14.`);
    if (matches.length > 0) {
        console.log("Sample match status:", matches[0].status);
    }
}

checkWeek14();
