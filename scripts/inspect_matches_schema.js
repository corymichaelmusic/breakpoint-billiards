
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectSchema() {
    console.log("Inspecting 'matches' table schema...");

    // We can't directly query schema easily with js client without raw sql or inspecting a row
    // Let's fetch one match and print keys
    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching match:', error);
        return;
    }

    if (matches && matches.length > 0) {
        console.log('Match columns:', Object.keys(matches[0]));
    } else {
        console.log('No matches found to inspect.');
    }
}

inspectSchema();
