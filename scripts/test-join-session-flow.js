
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testJoinSessionFlow() {
    const userId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9'; // Cory
    console.log(`Testing for user: ${userId}`);

    // 1. Fetch all active LEAGUES
    const { data: leagues } = await supabase
        .from("leagues")
        .select("id, name")
        .eq("type", "league")
        .eq("status", "active");

    // 2. Fetch all setup AND active SESSIONS
    const { data: sessions } = await supabase
        .from("leagues")
        .select("id, name, status, parent_league_id")
        .eq("type", "session")
        .in("status", ["setup", "active"]);

    console.log('Total sessions found:', sessions.length);
    sessions.forEach(s => console.log(`  - ${s.name} (${s.id})`));

    // 3. Fetch user's existing memberships
    const { data: myMemberships } = await supabase
        .from("league_players")
        .select("league_id")
        .eq("player_id", userId);

    const myLeagueIds = new Set(myMemberships?.map(m => m.league_id) || []);
    console.log('User is already in sessions:', Array.from(myLeagueIds));

    // 4. Group and Filter
    const formattedLeagues = leagues?.map(league => {
        const leagueSessions = sessions?.filter(s =>
            s.parent_league_id === league.id &&
            !myLeagueIds.has(s.id)
        ) || [];

        return {
            ...league,
            sessions: leagueSessions
        };
    }).filter(l => l.sessions.length > 0) || [];

    console.log('\nAvailable Sessions to Join:');
    formattedLeagues.forEach(l => {
        console.log(`League: ${l.name}`);
        l.sessions.forEach(s => {
            console.log(`  - ${s.name} (${s.status})`);
        });
    });
}

testJoinSessionFlow();
