
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

async function investigate() {
    console.log('1. Checking Games for Week 1...');
    // Get Week 1 match IDs first
    const { data: matches } = await supabase.from('matches').select('id').eq('week_number', 1);
    const matchIds = matches.map(m => m.id);

    const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('id, match_id, winner_id, loser_id, created_at')
        .in('match_id', matchIds);

    console.log(`Found ${games ? games.length : 0} games for Week 1 matches.`);
    if (games && games.length > 0) {
        console.log('Sample Game:', games[0]);
    }

    console.log('\n2. Listing All Tables...');
    // Note: listing tables via RPC or just guessing common names if RPC not available.
    // We can try to query `information_schema` if allowed.
    // Or just try specific names.

    const candidates = ['rating_history', 'rating_changes', 'player_history', 'match_history', 'distributions'];
    for (const table of candidates) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (!error) console.log(`Table exists: ${table}`);
        else console.log(`Table check failed: ${table} (${error.code})`);
    }

    console.log('\n3. Checking Profiles for history columns...');
    const { data: profile } = await supabase.from('profiles').select('*').limit(1);
    if (profile && profile.length) {
        console.log('Profile Keys:', Object.keys(profile[0]));
    }
}

investigate();
