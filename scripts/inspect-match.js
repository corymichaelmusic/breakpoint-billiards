
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectMatch() {
    const matchId = '1c5c9dc0-87c4-4738-9087-84c768c97e12';
    console.log(`Inspecting match ${matchId}...`);

    const { data: match, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Match Data:', match);

    // Check if backfill logic would apply
    const p1 = match.points_8ball_p1 || 0;
    const p2 = match.points_8ball_p2 || 0;
    const r1 = match.race_8ball_p1 || 0;
    const r2 = match.race_8ball_p2 || 0;

    console.log(`8-Ball: P1=${p1}/${r1}, P2=${p2}/${r2}`);

    if (match.status_8ball === 'finalized' && !match.winner_id_8ball) {
        console.log('8-Ball is finalized but has no winner.');
        if (p1 >= r1 && p2 >= r2 && r1 > 0 && r2 > 0) {
            console.log('Condition: Both over limit');
        } else if (p1 > p2) {
            console.log('Condition: P1 > P2');
        } else if (p2 > p1) {
            console.log('Condition: P2 > P1');
        } else {
            console.log('Condition: Tie or unknown');
        }
    }
}

inspectMatch();
