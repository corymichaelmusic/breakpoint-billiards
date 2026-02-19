
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

try {
    const envConfig = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env.local')));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log('Could not load .env.local');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHistory() {
    console.log('Checking historical data...');

    // 1. Check if 'rating_history' table exists
    const { error: historyError } = await supabase.from('rating_history').select('*').limit(1);
    if (historyError) {
        console.log('rating_history table does NOT exist or is not accessible.');
    } else {
        console.log('rating_history table exists!');
    }

    // 2. Check finalized matches for race data
    const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id, created_at, started_at, race_8ball_p1, race_8ball_p2, player1_rating')
        .eq('status', 'finalized')
        .limit(5)
        .order('created_at', { ascending: false });

    if (matchesError) {
        console.error('Error fetching matches:', matchesError);
        return;
    }

    console.log('Sample Finalized Matches:');
    console.log(JSON.stringify(matches, null, 2));
}

checkHistory();
