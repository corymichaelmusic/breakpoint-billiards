
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkJoinState() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const userId = "user_36G4WUMW9oc8aohN8s6FQUX6Xe9"; // Cory

    // 1. Find Session "Spring 2026"
    const { data: sessions } = await supabase
        .from('leagues')
        .select('id, name, parent_league_id, operator_id')
        .ilike('name', '%Spring 2026%');

    if (!sessions || sessions.length === 0) {
        console.log("No session found matching 'Spring 2026'");
        return;
    }

    const session = sessions[0];
    console.log("Found Session:", session);

    // 2. Check Parent League Operator
    const { data: parent } = await supabase
        .from('leagues')
        .select('operator_id')
        .eq('id', session.parent_league_id)
        .single();

    console.log("Parent League Operator:", parent?.operator_id);
    console.log("Is User Operator?", parent?.operator_id === userId);

    // 3. Check League Players Entry
    const { data: membership } = await supabase
        .from('league_players')
        .select('*')
        .eq('league_id', session.id)
        .eq('player_id', userId);

    console.log("Membership Entry:", membership);
}

checkJoinState();
