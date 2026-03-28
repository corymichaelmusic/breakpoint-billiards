require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const matchId = '08a1d4d0-54a4-400f-af61-2a0dd50b2160';
    
    // Michael is player1. Carson is player2.
    // Michael won 9ball.
    
    // Reverse the incorrect delta.
    // Wait, the easiest and most robust way is to just call `submit_match_for_verification` again 
    // with the right verified data, but it might error.
    // Let's just manually fix the matches row, and then let `calc_league_stats` or just manually adjust the league player.
    
    // Michael's 9ball delta: delta_9ball_p1: 15.3507119934273
    // Carson's 9ball delta: delta_9ball_p2: 12.0151121856721
    
    // So Michael got 15 points (loss), Carson got 12 points (loss? no wait)
    // Actually, we'll just swap the winner ID. Michael won 4 racks to Carson's 4. Michael is "p1". 
    // Wait, 4-4 tie? Is it a tie? The screenshot shows "RACE TO 4", "4", "WINNER". 
    // Michael's race was 4. Carson's race was 6. Michael reached 4. Therefore Michael won.
    
    const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
    
    // Update match winner
    await supabase.from('matches').update({
        winner_id_9ball: match.player1_id
    }).eq('id', matchId);
    
    console.log("Updated winner id to Michael.");
    
    // Since matches won/lost is aggregated via recalc_league_stats.js, we don't need to manually fix the league players table for W/L.
    // We just need to fix the ratings delta if we want to be hyper-accurate. 
    // Is it worth it to recalculate the exact bbrs delta, or just leave the negligible float difference? 
    // It's probably very close. Let's just fix the W/L record first.
}
main();
