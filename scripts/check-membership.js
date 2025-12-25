
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Replace with the specific user ID if known, otherwise we might need to look it up or list all.
// For now, let's list all memberships for the most recent session.

async function checkMembership() {
    // 1. Get the most recent session
    const { data: sessions } = await supabase
        .from("leagues")
        .select("id, name")
        .eq("type", "session")
        .order("created_at", { ascending: false })
        .limit(1);

    if (!sessions || sessions.length === 0) {
        console.log("No sessions found.");
        return;
    }

    const session = sessions[0];
    console.log(`Checking membership for Session: ${session.name} (${session.id})`);

    // 2. Get memberships
    const { data: memberships } = await supabase
        .from("league_players")
        .select("player_id, status, profiles(full_name, email)")
        .eq("league_id", session.id);

    console.log("Memberships:", JSON.stringify(memberships, null, 2));
}

checkMembership();
