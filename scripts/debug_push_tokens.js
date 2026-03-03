require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const sessionId = "2b08d033-f2cd-47cc-b6d8-78544a5df684"; // Spring 2026

    const { data: pushPlayers, error } = await supabase
        .from('league_players')
        .select(`
            player_id,
            profiles!inner(id, full_name, push_token, is_active, notify_league)
        `)
        .eq('league_id', sessionId)
        .eq('status', 'active')
        .eq('profiles.is_active', true)
        .not('profiles.push_token', 'is', null)
        .not('profiles.notify_league', 'is', false);

    console.log("Error?", error);
    console.log("Push Players:", JSON.stringify(pushPlayers, null, 2));
}

main();
