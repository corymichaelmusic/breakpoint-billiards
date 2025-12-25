const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLeaguesAndSessions() {
    console.log("Checking Leagues (type='league')...");
    const { data: leagues, error: lError } = await supabase
        .from("leagues")
        .select("id, name, status, type")
        .eq("type", "league");

    if (lError) console.error("Error fetching leagues:", lError);
    else console.table(leagues);

    console.log("\nChecking Sessions (type='session')...");
    const { data: sessions, error: sError } = await supabase
        .from("leagues")
        .select("id, name, status, type, parent_league_id")
        .eq("type", "session");

    if (sError) console.error("Error fetching sessions:", sError);
    else console.table(sessions);
}

checkLeaguesAndSessions();
