const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const michaelId = 'user_38xbqBHx2bj8x2YO9FF5LwYQgTa';
    const { data: lp } = await supabase.from('league_players').select('*').eq('player_id', michaelId);
    console.log("--- Michael's league_players Records ---");
    lp.forEach(p => {
        console.log(`League: ${p.league_id}, Matches Played: ${p.matches_played}, Matches Won: ${p.matches_won}, Shutouts: ${p.shutouts}`);
    });
}
run();
