const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const matchId = '1060c490-7566-4afa-bf7a-ce11b50198cf';
    const michaelId = 'user_38xbqBHx2bj8x2YO9FF5LwYQgTa';
    
    console.log("Updating match: " + matchId);
    const { error: updateError } = await supabase.from('matches')
        .update({
            winner_id_8ball: michaelId,
            status_8ball: 'finalized'
        })
        .eq('id', matchId);

    if (updateError) {
        console.error("Error updating match:", updateError);
        return;
    }

    console.log("Match updated successfully!");
}
run();
