
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

async function backfillWeek1() {
    console.log('Fetching Week 1 matches...');

    const { data: matches, error: fetchError } = await supabase
        .from('matches')
        .select('id, player1_id, player2_id')
        .eq('week_number', 1);

    if (fetchError) {
        console.error('Error fetching matches:', fetchError);
        return;
    }

    console.log(`Found ${matches.length} matches for Week 1.`);

    // Fetch all profiles to get current ratings
    // Optimization: Fetch only needed profiles if list is huge, but here likely small.
    const playerIds = new Set();
    matches.forEach(m => {
        if (m.player1_id) playerIds.add(m.player1_id);
        if (m.player2_id) playerIds.add(m.player2_id);
    });

    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, breakpoint_rating')
        .in('id', Array.from(playerIds));

    if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
    }

    const ratingMap = {};
    profiles.forEach(p => {
        ratingMap[p.id] = p.breakpoint_rating;
    });

    console.log('Backfilling ratings...');
    let updatedCount = 0;

    for (const match of matches) {
        const p1Rating = ratingMap[match.player1_id];
        const p2Rating = ratingMap[match.player2_id];

        if (p1Rating !== undefined && p2Rating !== undefined) {
            const { error: updateError } = await supabase
                .from('matches')
                .update({
                    player1_rating: p1Rating,
                    player2_rating: p2Rating
                })
                .eq('id', match.id);

            if (updateError) {
                console.error(`Failed to update match ${match.id}:`, updateError);
            } else {
                updatedCount++;
            }
        } else {
            console.warn(`Skipping match ${match.id} due to missing profile ratings.`);
        }
    }

    console.log(`Successfully backfilled ${updatedCount} matches.`);
}

backfillWeek1();
