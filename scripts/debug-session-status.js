const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function checkSessionDetails() {
    console.log(`Checking session details for user: ${USER_ID}`);

    const { data: memberships, error } = await supabase
        .from("league_players")
        .select(`
            league_id,
            status,
            leagues (
                id,
                name,
                type,
                status
            )
        `)
        .eq("player_id", USER_ID);

    if (error) {
        console.error("Error fetching memberships:", error);
        return;
    }

    console.log("Memberships found:", JSON.stringify(memberships, null, 2));
}

checkSessionDetails();
