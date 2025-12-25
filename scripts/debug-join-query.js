const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LEAGUE_ID = 'ad10328d-822b-4cc5-80ec-1cec4e3e373e';

async function checkJoinQuery() {
    console.log("Testing JOIN query...");
    const { data, error } = await supabase
        .from("league_players")
        .select("player_id, profiles(full_name, email)")
        .eq("league_id", LEAGUE_ID);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${data.length} records.`);
        console.log("Sample record:", JSON.stringify(data[0], null, 2));

        const withProfile = data.filter(d => d.profiles);
        console.log(`Records with profile data: ${withProfile.length}`);
    }
}

checkJoinQuery();
