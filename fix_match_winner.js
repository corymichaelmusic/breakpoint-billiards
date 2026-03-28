const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const matchId = 'b86a8362-e6e2-475a-bb57-dbe386f78fec';
    const michaelId = '054b1f61-26ec-4a9f-861f-93d39994f71a';
    
    console.log("Updating match:", matchId);
    console.log("Setting winner_id_8ball to Michael:", michaelId);
    
    const { data: match, error: fetchError } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (fetchError) {
        console.error("Error fetching match:", fetchError);
        return;
    }

    // Double check points/race
    console.log(`Current state: 8ball Score ${match.points_8ball_p1}-${match.points_8ball_p2}, Race ${match.race_to_8ball_p1}-${match.race_to_8ball_p2}`);
    
    const { error: updateError } = await supabase.from('matches')
        .update({
            winner_id_8ball: michaelId,
            // Also ensure overall winner_id reflects the total points if both finished
            // P1 Total: 3 (8ball) + 1 (9ball) = 4
            // P2 Total: 5 (8ball) + 8 (9ball) = 13
            // So John is still the overall winner of the session match, but Michael won the 8-ball set.
            // Wait, the user said "Michael should have won 8 ball". 
            // In 8-ball, Michael reached 3 (his race). John reached 5 (race to 6).
            // So Michael won 8-ball.
            // Overall winner is usually total points. 4 vs 13. John won overall.
        })
        .eq('id', matchId);

    if (updateError) {
        console.error("Error updating match:", updateError);
        return;
    }

    console.log("Match updated successfully!");
    
    // Also cleanup messy games if needed?
    // Let's at least verify now.
    const { data: updatedMatch } = await supabase.from('matches').select('winner_id_8ball').eq('id', matchId).single();
    console.log("New winner_id_8ball:", updatedMatch.winner_id_8ball);
}
run();
