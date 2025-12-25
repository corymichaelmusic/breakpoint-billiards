const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LEAGUE_ID = 'ad10328d-822b-4cc5-80ec-1cec4e3e373e';

async function fixLeagueStatus() {
    console.log(`Checking status for league ${LEAGUE_ID}...`);
    const { data: league } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", LEAGUE_ID)
        .single();

    console.log("Current League Data:", league);

    if (league && league.status !== 'active') {
        console.log("Updating status to 'active'...");
        const { error } = await supabase
            .from("leagues")
            .update({ status: 'active' })
            .eq("id", LEAGUE_ID);

        if (error) console.error("Error updating status:", error);
        else console.log("Success! League is now active.");
    }
}

fixLeagueStatus();
