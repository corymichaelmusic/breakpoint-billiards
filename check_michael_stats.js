const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const michaelId = 'user_38xbqBHx2bj8x2YO9FF5LwYQgTa';
    
    // Check league_players table
    const { data: lp } = await supabase.from('league_players').select('*').eq('player_id', michaelId);
    console.log("--- league_players stats ---");
    console.log(JSON.stringify(lp, null, 2));

    // Check matches in Spring 2026 (assuming that's the current league)
    const { data: league } = await supabase.from('leagues').select('id').ilike('name', '%Spring 2026%').single();
    if (league) {
        console.log("\n--- Matches for Michael in Spring 2026 (" + league.id + ") ---");
        const { data: matches } = await supabase.from('matches')
            .select('*')
            .eq('league_id', league.id)
            .or(`player1_id.eq.${michaelId},player2_id.eq.${michaelId}`);
        
        matches.forEach(m => {
            console.log(`Match ${m.id}: Week ${m.week_number}, 8ball Winner: ${m.winner_id_8ball}, 9ball Winner: ${m.winner_id_9ball}`);
        });
    }
}
run();
