const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LEAGUE_ID = 'ba1dbf2a-2103-4883-b218-4d4b20d99541'; // Metro Pool League

async function checkProfiles() {
    // Get player IDs from league_players
    const { data: lp } = await supabase
        .from("league_players")
        .select("player_id")
        .eq("league_id", LEAGUE_ID);

    const playerIds = lp.map(p => p.player_id);
    console.log(`Found ${playerIds.length} player IDs in league_players.`);

    // Check profiles
    const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", playerIds);

    console.log(`Found ${profiles.length} matching profiles.`);

    const missing = playerIds.filter(id => !profiles.find(p => p.id === id));
    console.log(`Missing profiles for ${missing.length} IDs:`, missing);
}

checkProfiles();
