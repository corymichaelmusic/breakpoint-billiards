require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const matchId = '08a1d4d0-54a4-400f-af61-2a0dd50b2160';
    
    // 1. Get Match Info
    const { data: match } = await supabase.from('matches').select('winner_id_9ball, status_9ball, race_9ball_p1, race_9ball_p2, player1_id, player2_id').eq('id', matchId).single();
    console.log("Match:", match);
    
    // 2. We need to back out the wrong delta and apply the right one.
    // Currently, Carson (p2) was marked as the winner.
    // Let's see the current rating and stats for both players in the league
    const { data: lp1 } = await supabase.from('league_players').select('player_id, matches_won, matches_played').eq('player_id', match.player1_id).eq('league_id', '2b08d033-f2cd-47cc-b6d8-78544a5df684').single();
    const { data: lp2 } = await supabase.from('league_players').select('player_id, matches_won, matches_played').eq('player_id', match.player2_id).eq('league_id', '2b08d033-f2cd-47cc-b6d8-78544a5df684').single();
    console.log("Michael LP stats:", lp1);
    console.log("Carson LP stats:", lp2);
}
main();
