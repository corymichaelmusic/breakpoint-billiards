
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    const { data, error } = await supabase
        .from('matches')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching matches:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Matches columns:', Object.keys(data[0]));
    } else {
        console.log('No matches found to inspect columns.');
    }
}

inspectSchema();
