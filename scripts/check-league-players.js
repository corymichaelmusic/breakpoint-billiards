const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LEAGUE_ID = 'ad10328d-822b-4cc5-80ec-1cec4e3e373e'; // Breakpoint Billiards Money Monday

async function checkLeaguePlayers() {
    console.log(`Checking players for league: ${LEAGUE_ID}`);
    const { data: players, error } = await supabase
        .from("league_players")
        .select("player_id, profiles(full_name)")
        .eq("league_id", LEAGUE_ID);

    if (error) console.error("Error:", error);
    else {
        console.log(`Found ${players.length} players.`);
        console.table(players.map(p => ({ id: p.player_id, name: p.profiles?.full_name })));
    }
}

checkLeaguePlayers();
