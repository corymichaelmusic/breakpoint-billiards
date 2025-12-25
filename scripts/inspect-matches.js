const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectMatches() {
    console.log('Inspecting a few finalized matches...');
    const { data: matches } = await supabase.from('matches').select('*').eq('status', 'finalized').limit(5);
    

    for (const m of matches) {
        const { data: games } = await supabase.from('games').select('*').eq('match_id', m.id);
        console.log(`Match ${m.id}: Games Found: ${games ? games.length : 0}`);
        console.log('Match Data:', { 
            winner: m.winner_id, 
            p1_8: m.points_8ball_p1, p2_8: m.points_8ball_p2, 
            p1_9: m.points_9ball_p1, p2_9: m.points_9ball_p2 
        });
    }
}
inspectMatches();
