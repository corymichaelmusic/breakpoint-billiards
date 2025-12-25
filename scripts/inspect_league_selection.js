
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLeagueStatus() {
    console.log("Fetching User Leagues and Status...");

    // Fetch league_players with joined league info
    const userId = "user_36G4WUMW9oc8aohN8s6FQUX6Xe9"; // From previous output
    const { data: members, error } = await supabase
        .from('league_players')
        .select(`
            league_id, 
            matches_played,
            league:leagues (id, name, status, created_at)
        `)
        .eq('player_id', userId);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${members.length} memberships.`);
    members.forEach(m => {
        console.log(`\nLeague: ${m.league.name} (${m.league.id})`);
        console.log(`Status: ${m.league.status}`);
        console.log(`Created: ${m.league.created_at}`);
        console.log(`My Stats: ${m.matches_played} matches played`);
    });
}

inspectLeagueStatus();
