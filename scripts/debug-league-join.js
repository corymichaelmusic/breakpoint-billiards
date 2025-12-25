const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debugLeagueJoin() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Check if table exists by selecting from it
    const { data: tableCheck, error: tableError } = await supabase
        .from('league_players')
        .select('*')
        .limit(1);

    if (tableError) {
        console.error('Error accessing league_players table:', tableError);
    } else {
        console.log('league_players table exists. Sample data:', tableCheck);
    }

    // 2. Check for the specific user
    const userId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9'; // The user we are working with
    const { data: userRecord, error: userError } = await supabase
        .from('league_players')
        .select('*')
        .eq('player_id', userId);

    if (userError) {
        console.error('Error checking user record:', userError);
    } else {
        console.log('User record in league_players:', userRecord);
    }
}

debugLeagueJoin();
