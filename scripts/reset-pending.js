const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';
const SESSION_ID = 'b7faf87b-eed9-45ea-b790-2a3572a3298f'; // Winter 2026

async function resetToPending() {
    console.log("Resetting player status to 'pending' for Winter 2026...");

    const { error } = await supabase
        .from("league_players")
        .update({ status: 'pending' })
        .eq("league_id", SESSION_ID)
        .eq("player_id", USER_ID);

    if (error) console.error("Error:", error);
    else console.log("Success! Status is now pending.");
}

resetToPending();
