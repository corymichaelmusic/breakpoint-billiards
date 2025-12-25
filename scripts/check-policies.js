
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
    console.log("Checking policies for league_players...");

    const { data, error } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'league_players');

    if (error) {
        console.error("Error fetching policies:", error);
        return;
    }

    console.log("Policies:", JSON.stringify(data, null, 2));
}

checkPolicies();
