const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWinterLeague() {
    console.log("Searching for 'Winter 2026'...");
    const { data: leagues } = await supabase
        .from("leagues")
        .select("id, name, type, operator_id")
        .ilike("name", "%Winter 2026%");

    console.table(leagues);

    for (const league of leagues) {
        // Get Parent League ID
        const { data: fullLeague } = await supabase
            .from("leagues")
            .select("parent_league_id")
            .eq("id", league.id)
            .single();

        if (fullLeague?.parent_league_id) {
            console.log(`Parent League ID: ${fullLeague.parent_league_id}`);

            const { data: parent } = await supabase
                .from("leagues")
                .select("name")
                .eq("id", fullLeague.parent_league_id)
                .single();
            console.log(`Parent League Name: ${parent?.name}`);

            const { count } = await supabase
                .from("league_players")
                .select("*", { count: 'exact', head: true })
                .eq("league_id", fullLeague.parent_league_id);
            console.log(`Parent League has ${count} players.`);
        } else {
            console.log("No parent league found (is this a top-level league?).");
        }
        const { count } = await supabase
            .from("league_players")
            .select("*", { count: 'exact', head: true })
            .eq("league_id", league.id);
        console.log(`League "${league.name}" (${league.id}) has ${count} players.`);

        // Check for pending players specifically
        const { count: pending } = await supabase
            .from("league_players")
            .select("*", { count: 'exact', head: true })
            .eq("league_id", league.id)
            .eq("status", "pending");
        console.log(`  - Pending: ${pending}`);
    }
}

checkWinterLeague();
