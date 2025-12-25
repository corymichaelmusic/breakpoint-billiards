
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectMatchesStatus() {
    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, status, status_8ball, status_9ball')
        .or('status_8ball.eq.finalized,status_9ball.eq.finalized');

    if (error) console.error(error);
    else {
        console.log(`Found ${matches.length} matches with randomized status.`);
        console.log(JSON.stringify(matches, null, 2));
    }
}
inspectMatchesStatus();
