const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listPlayers() {
    // Get the first active session
    const { data: sessions } = await supabase
        .from("leagues")
        .select("id, name")
        .eq("type", "session")
        .limit(1);

    if (!sessions || sessions.length === 0) {
        console.log("No sessions found.");
        return;
    }

    const session = sessions[0];
    console.log(`Checking players for session: ${session.name} (${session.id})`);

    const { data: players } = await supabase
        .from("league_players")
        .select("player_id, profiles(full_name)")
        .eq("league_id", session.id)
        .limit(5);

    console.log("Players found:", JSON.stringify(players, null, 2));
}

listPlayers();
