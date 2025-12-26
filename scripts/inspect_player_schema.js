const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectSchema() {
    // Check Profiles columns
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (profileError) console.error('Error fetching profiles:', profileError);
    else if (profileData.length > 0) console.log('Profiles Columns:', Object.keys(profileData[0]));
    else console.log('Profiles table empty, cannot infer columns.');

    // Check League Players columns
    const { data: lpData, error: lpError } = await supabase
        .from('league_players')
        .select('*')
        .limit(1);

    if (lpError) console.error('Error fetching league_players:', lpError);
    else if (lpData.length > 0) console.log('League Players Columns:', Object.keys(lpData[0]));
    else console.log('League Players table empty.');
}

inspectSchema();
