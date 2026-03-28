require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const matchId = 'de7cafc6-c2f5-423f-890b-06c754a9825e'; // Jared vs John

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
    console.log("Player 1 (Jared):", match.player1_id);
    console.log("Player 2 (John):", match.player2_id);
    
    // Set John as the winner of 9-ball and apply proper races.
    const { error: updateError } = await supabase
        .from('matches')
        .update({
            race_8ball_p1: 4,
            race_8ball_p2: 7,
            race_9ball_p1: 5, // Jared
            race_9ball_p2: 8, // John
            winner_id_9ball: match.player2_id // John
        })
        .eq('id', matchId);

    if (updateError) {
        console.error("Failed to update match", updateError);
        return;
    }

    console.log("Match successfully updated. John is now the 9-ball winner and races are saved.");
}

main();
