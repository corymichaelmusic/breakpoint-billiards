
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectMatchesColumns() {
    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .limit(1);

    if (error) console.error(error);
    else if (matches.length > 0) {
        console.log("Matches Columns:");
        console.log(Object.keys(matches[0]));
    } else {
        console.log("No matches found to inspect columns.");
    }
}
inspectMatchesColumns();
