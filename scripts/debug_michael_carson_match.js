require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data: p1v } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%Michael Moschella%');
    const { data: p2v } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%Carson Mills%');
    console.log('Michael:', p1v, 'Carson:', p2v);

    if (p1v.length && p2v.length) {
        let p1 = p1v[0].id; let p2 = p2v[0].id;
        const { data: matches } = await supabase.from('matches').select('*')
            .or(`and(player1_id.eq.${p1},player2_id.eq.${p2}),and(player1_id.eq.${p2},player2_id.eq.${p1})`)
            .order('created_at', { ascending: false });
        console.log('Matches:', matches.map(m => ({
            id: m.id,
            status_9ball: m.status_9ball,
            points_9ball_p1: m.points_9ball_p1,
            points_9ball_p2: m.points_9ball_p2,
            score_9ball_p1: m.score_9ball_p1,
            score_9ball_p2: m.score_9ball_p2,
            race_9ball_p1: m.race_9ball_p1,
            race_9ball_p2: m.race_9ball_p2,
            winner_id_9ball: m.winner_id_9ball,
            player1_id: m.player1_id,
        })));
    }
}
main();
