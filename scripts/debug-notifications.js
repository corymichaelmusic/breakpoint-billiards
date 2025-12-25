
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugNotifications() {
    console.log("--- Debugging Notifications ---");

    // 1. Get the pending player record
    const { data: pending } = await supabase
        .from("league_players")
        .select("league_id, player_id, status")
        .eq("status", "pending")
        .limit(1);

    if (!pending || pending.length === 0) {
        console.log("No pending requests found in DB.");
        return;
    }

    const request = pending[0];
    console.log("Found Pending Request:", request);

    // 2. Get the League/Session it belongs to
    const { data: leagueOrSession } = await supabase
        .from("leagues")
        .select("id, name, type, parent_league_id, operator_id")
        .eq("id", request.league_id)
        .single();

    console.log("Target League/Session:", leagueOrSession);

    if (leagueOrSession.type === 'session') {
        // 3. Get the Parent League
        const { data: parent } = await supabase
            .from("leagues")
            .select("id, name, operator_id")
            .eq("id", leagueOrSession.parent_league_id)
            .single();

        console.log("Parent League:", parent);

        // 4. Check if Parent League matches what we expect for the dashboard query
        // Dashboard fetches leagues where operator_id = current_user
        // Then fetches sessions where parent_league_id IN (those leagues)

        console.log(`Dashboard Logic Check:`);
        console.log(`- Does Parent Operator ID match? (Check your user ID)`);
        console.log(`- Is Parent ID in the list of operator's leagues? Yes, if operator matches.`);
    }
}

debugNotifications();
