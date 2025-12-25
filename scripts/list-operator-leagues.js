const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function listOperatorLeagues() {
    console.log("Listing leagues for operator:", USER_ID);
    const { data: leagues } = await supabase
        .from("leagues")
        .select("id, name, type, created_at")
        .eq("operator_id", USER_ID)
        .eq("type", "league");

    console.table(leagues);

    for (const league of leagues) {
        const { count } = await supabase
            .from("league_players")
            .select("*", { count: 'exact', head: true })
            .eq("league_id", league.id);
        console.log(`League "${league.name}" (${league.id}) has ${count} players.`);

        if (count <= 1) {
            console.log(`!!! League "${league.name}" is effectively empty.`);
        }
    }
}

listOperatorLeagues();
