const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function simulateJoin() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Get a league
    const { data: leagues } = await supabase.from('leagues').select('id').limit(1);
    if (!leagues || leagues.length === 0) {
        console.error('No leagues found to join.');
        return;
    }
    const leagueId = leagues[0].id;
    const userId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

    console.log(`Attempting to join league: ${leagueId} for user: ${userId}`);

    const { data, error } = await supabase
        .from("league_players")
        .insert({
            league_id: leagueId,
            player_id: userId,
            status: 'pending'
        })
        .select();

    if (error) {
        console.error("Error joining league:", error);
    } else {
        console.log("Successfully joined league:", data);
    }
}

simulateJoin();
