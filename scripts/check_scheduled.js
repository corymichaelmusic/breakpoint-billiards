
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

async function checkScheduled() {
    console.log('Checking sample scheduled matches...');
    const { data, error } = await supabase
        .from('matches')
        .select('id, player1_rating, player2_rating, race_8ball_p1')
        .eq('status', 'scheduled')
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Sample Scheduled Data:', JSON.stringify(data, null, 2));
    }
}

checkScheduled();
