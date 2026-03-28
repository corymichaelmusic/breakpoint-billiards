const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // We already confirmed MATCH_ID=1060c490-7566-4afa-bf7a-ce11b50198cf
    const matchId = '1060c490-7566-4afa-bf7a-ce11b50198cf';
    const michaelId = 'user_38xbqBHx2bj8x2YO9FF5LwYQgTa';
    
    const { data: match, error } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (error) {
        console.error("Error fetching match:", error);
        return;
    }
    
    console.log("--- FINAL VERIFICATION ---");
    console.log("Match ID:", matchId);
    console.log("Winner 8-Ball ID:", match.winner_id_8ball);
    console.log("Expected Michael ID:", michaelId);
    console.log("Match correct:", match.winner_id_8ball === michaelId ? "YES" : "NO");
    console.log("8-Ball Status:", match.status_8ball);
    console.log("8-Ball Score P1:", match.points_8ball_p1, "P2:", match.points_8ball_p2);
    console.log("8-Ball Race P1:", match.race_to_8ball_p1, "P2:", match.race_to_8ball_p2);
}
run();
