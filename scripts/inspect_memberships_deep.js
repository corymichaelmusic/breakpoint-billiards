
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLeagueMemberships() {
    const userId = "user_36G4WUMW9oc8aohN8s6FQUX6Xe9"; // Assuming this is C Mike Money
    console.log(`Inspecting memberships for ${userId}...`);

    const { data: members, error } = await supabase
        .from('league_players')
        .select(`
            id,
            matches_played,
            matches_won,
            league:leagues (id, name, status, operator_id)
        `)
        .eq('player_id', userId);

    if (error) console.error(error);
    else console.log(JSON.stringify(members, null, 2));
}

inspectLeagueMemberships();
