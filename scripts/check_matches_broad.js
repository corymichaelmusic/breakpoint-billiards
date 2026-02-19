
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

async function checkMatchesBroad() {
    console.log('Checking all matches with points...');

    // Check matches that have SOME progress, regardless of status
    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, status, race_8ball_p1, race_8ball_p2, race_9ball_p1, race_9ball_p2, player1_rating, points_8ball_p1, points_8ball_p2')
        .or('status.eq.finalized,status.eq.completed,status.eq.in_progress')
        .limit(10);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Matches Found:', JSON.stringify(matches, null, 2));
    }
}

checkMatchesBroad();
