
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role to bypass policies if needed, or to update safely

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFreeze() {
    console.log('Starting verification...');

    // 1. Find a scheduled match (not started)
    const { data: matches, error: fetchError } = await supabase
        .from('matches')
        .select('id, player1_id, player2_id, started_at, player1_rating')
        .is('started_at', null)
        .limit(1);

    if (fetchError || !matches || matches.length === 0) {
        console.error('Could not find a scheduled match to test with.');
        return;
    }

    const testMatch = matches[0];
    console.log(`Testing with Match ID: ${testMatch.id}`);

    // 2. "Start" the match
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
        .from('matches')
        .update({ started_at: now })
        .eq('id', testMatch.id);

    if (updateError) {
        console.error('Error starting match:', updateError);
        return;
    }

    // 3. Check if ratings were frozen
    const { data: updatedMatch, error: checkError } = await supabase
        .from('matches')
        .select('player1_rating, player2_rating, started_at')
        .eq('id', testMatch.id)
        .single();

    if (checkError) {
        console.error('Error re-fetching match:', checkError);
    } else {
        console.log('Updated Match Data:', updatedMatch);
        if (updatedMatch.player1_rating !== null && updatedMatch.player2_rating !== null) {
            console.log('SUCCESS: Ratings were frozen!');
        } else {
            console.error('FAILURE: Ratings were NOT frozen.');
        }
    }

    // 4. Cleanup (Rollback)
    console.log('Rolling back changes...');
    await supabase
        .from('matches')
        .update({
            started_at: null,
            player1_rating: null,
            player2_rating: null
        })
        .eq('id', testMatch.id);

    console.log('Rollback complete.');
}

verifyFreeze();
