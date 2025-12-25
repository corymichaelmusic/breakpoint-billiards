const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';
const SESSION_ID = 'b7faf87b-eed9-45ea-b790-2a3572a3298f'; // Winter 2026

async function waiveFees() {
    console.log("Waiving Session Creation Fee...");
    const { error: sessionError } = await supabase
        .from("leagues")
        .update({ creation_fee_status: 'waived' })
        .eq("id", SESSION_ID);

    if (sessionError) console.error("Error waiving session fee:", sessionError);
    else console.log("Session fee waived.");

    console.log("Waiving Player Fee...");
    const { error: playerError } = await supabase
        .from("league_players")
        .update({ payment_status: 'waived' })
        .eq("league_id", SESSION_ID)
        .eq("player_id", USER_ID);

    if (playerError) console.error("Error waiving player fee:", playerError);
    else console.log("Player fee waived.");
}

waiveFees();
