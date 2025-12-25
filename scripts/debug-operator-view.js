const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9'; // Cory Michael
const LEAGUE_ID = 'ad10328d-822b-4cc5-80ec-1cec4e3e373e'; // Breakpoint Billiards Money Monday

async function checkData() {
    console.log("--- Checking League Ownership ---");
    const { data: league } = await supabase
        .from("leagues")
        .select("id, name, operator_id")
        .eq("id", LEAGUE_ID)
        .single();

    console.log("League:", league);
    console.log("Is User Operator?", league.operator_id === USER_ID);

    console.log("\n--- Checking Pending Players ---");
    const { data: players } = await supabase
        .from("league_players")
        .select("league_id, player_id, status, leagues(name, type)")
        .eq("player_id", USER_ID); // Checking for the user themselves as they were the one who joined

    console.table(players);
}

checkData();
