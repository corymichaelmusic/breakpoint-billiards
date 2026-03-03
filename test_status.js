require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data: matches } = await supabase.from('matches').select('id, status, status_8ball, status_9ball, points_8ball_p1, points_8ball_p2, winner_id_8ball').eq('league_id', '2b08d033-f2cd-47cc-b6d8-78544a5df684');
    console.log(matches.slice(0, 3));
}
run();
