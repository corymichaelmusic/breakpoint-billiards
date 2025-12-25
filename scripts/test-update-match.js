const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testUpdate() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get a scheduled match
    const { data: matches } = await supabase.from('matches').select('id').eq('status', 'scheduled').limit(1);

    if (!matches || matches.length === 0) {
        console.log('No scheduled matches found to test.');
        return;
    }

    const matchId = matches[0].id;
    console.log('Testing update on match:', matchId);

    const { data, error } = await supabase
        .from("matches")
        .update({
            score_8ball_p1: 10,
            score_8ball_p2: 0,
            score_9ball_p1: 5,
            score_9ball_p2: 5,
            status: "finalized",
            played_at: new Date().toISOString(),
        })
        .eq("id", matchId)
        .select();

    if (error) {
        console.error('Error updating match:', error);
    } else {
        console.log('Successfully updated match:', data);
    }
}

testUpdate();
