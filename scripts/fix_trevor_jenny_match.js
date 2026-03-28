require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const matchId = '8f1db585-e2fb-4781-9eeb-291719d56df8'; // Trevor vs Jenny

    const { data: match, error: fetchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();
        
    if (fetchError || !match) {
        console.error("Failed to fetch match", fetchError);
        return;
    }

    console.log("Fixing Match ID:", match.id);
    console.log("Player 1 (Trevor):", match.player1_id);
    console.log("Player 2 (Jenny):", match.player2_id);

    // Trevor hit 5 racks (his race was 5). Jenny hit 5 racks (her race was 6).
    // The UI incorrectly calculated `winner_id_9ball` as Jenny because of dynamically shifted races.
    
    // We update the matches table to set the races accurately.
    // And assign Trevor as the winner of 9-ball.
    const { error: updateError } = await supabase
        .from('matches')
        .update({
            race_8ball_p1: 5,
            race_8ball_p2: 5,
            race_9ball_p1: 5, // Trevor
            race_9ball_p2: 6, // Jenny
            winner_id_9ball: match.player1_id
        })
        .eq('id', matchId);

    if (updateError) {
        console.error("Failed to update match", updateError);
        return;
    }

    console.log("Match successfully updated. Trevor is now the 9-ball winner and races are saved.");
}

main();
