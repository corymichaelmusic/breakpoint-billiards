const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function listAllMemberships() {
    const { data: memberships } = await supabase
        .from("league_players")
        .select("league_id, leagues(id, name, type, status)")
        .eq("player_id", USER_ID);

    console.log(JSON.stringify(memberships, null, 2));
}

listAllMemberships();
