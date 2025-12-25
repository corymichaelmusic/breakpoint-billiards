const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function verifyUser() {
    const { data: lp } = await supabase
        .from("league_players")
        .select("league_id, leagues(name)")
        .eq("player_id", USER_ID);

    console.log("User memberships:", JSON.stringify(lp, null, 2));
}

verifyUser();
