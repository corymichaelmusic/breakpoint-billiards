
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMatchWinners() {
    console.log('Fetching finalized matches without winner_id...');

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'finalized')
        .is('winner_id', null);

    if (error) {
        console.error('Error fetching matches:', error);
        return;
    }

    console.log(`Found ${matches.length} matches to fix.`);

    for (const match of matches) {
        const p1Total = (match.points_8ball_p1 || 0) + (match.points_9ball_p1 || 0);
        const p2Total = (match.points_8ball_p2 || 0) + (match.points_9ball_p2 || 0);

        let winnerId = null;
        if (p1Total > p2Total) {
            winnerId = match.player1_id;
        } else if (p2Total > p1Total) {
            winnerId = match.player2_id;
        }

        if (winnerId) {
            console.log(`Fixing Match ${match.id}: P1(${p1Total}) vs P2(${p2Total}) -> Winner: ${winnerId}`);
            const { error: updateError } = await supabase
                .from('matches')
                .update({ winner_id: winnerId })
                .eq('id', match.id);

            if (updateError) {
                console.error(`Failed to update match ${match.id}:`, updateError);
            }
        } else {
            console.log(`Match ${match.id} is a tie (${p1Total}-${p2Total}), skipping winner_id.`);
        }
    }

    console.log('Done!');
}

fixMatchWinners();
