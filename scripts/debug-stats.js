const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectMatches() {
    console.log('Fetching matches for Spring 2026...');
    // Finding the session first
    const { data: sessions } = await supabase.from('leagues').select('id').eq('name', 'Spring 2026').single();

    const { data: matches } = await supabase.from('matches')
        .select('id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball')
        .eq('league_id', sessions.id)
        .eq('status', 'finalized');
        
    console.log(`Found ${matches.length} finalized matches.`);
    
    // Check points
    matches.forEach(m => {
        console.log(`Match ${m.id}: Cur(${m.current_points_p1}-${m.current_points_p2}) 8B(${m.points_8ball_p1}-${m.points_8ball_p2}) 9B(${m.points_9ball_p1}-${m.points_9ball_p2}) Winners(8:${m.winner_id_8ball}, 9:${m.winner_id_9ball})`);
    });
}
inspectMatches();
