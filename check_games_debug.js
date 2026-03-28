const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const matchId = 'b86a8362-e6e2-475a-bb57-dbe386f78fec';
    
    console.log("Fetching games for match:", matchId);
    const { data: games, error } = await supabase.from('games').select('*').eq('match_id', matchId).order('game_number', { ascending: true });
    
    if (error) {
        console.error("Error fetching games:", error);
        return;
    }

    console.log("Games found:", games.length);
    games.forEach(g => {
        console.log(`Game ${g.game_number} (${g.game_type}): Winner: ${g.winner_id}, Score: ${g.score_p1}-${g.score_p2}`);
    });

    const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
    console.log("Match Status 8ball:", match.status_8ball);
    console.log("Match Winner 8ball:", match.winner_id_8ball);
    console.log("Match Points 8ball: P1=${match.points_8ball_p1}, P2=${match.points_8ball_p2}");
    console.log("Match Race 8ball: P1=${match.race_to_8ball_p1}, P2=${match.race_to_8ball_p2}");
}
run();
