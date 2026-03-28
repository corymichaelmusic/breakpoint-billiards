require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    // Find Trevor and Jenny
    const { data: trevor } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%Trevor Phillips%');
    const { data: jenny } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%Jenny Smith%');
    console.log('Trevor:', trevor);
    console.log('Jenny:', jenny);
    
    if (!trevor?.length || !jenny?.length) { console.log("Players not found"); return; }
    
    const p1 = trevor[0].id;
    const p2 = jenny[0].id;
    
    // Find their matches
    const { data: matches } = await supabase.from('matches').select('*')
        .or(`and(player1_id.eq.${p1},player2_id.eq.${p2}),and(player1_id.eq.${p2},player2_id.eq.${p1})`)
        .order('created_at', { ascending: false })
        .limit(5);
    
    for (const m of matches) {
        console.log('\n--- Match ---');
        console.log('ID:', m.id);
        console.log('Week:', m.week_number);
        console.log('Player1:', m.player1_id, 'Player2:', m.player2_id);
        console.log('--- 8ball ---');
        console.log('  status:', m.status_8ball, 'winner:', m.winner_id_8ball);
        console.log('  scores: p1=', m.score_8ball_p1, 'p2=', m.score_8ball_p2);
        console.log('  points: p1=', m.points_8ball_p1, 'p2=', m.points_8ball_p2);
        console.log('  races: p1=', m.race_8ball_p1, 'p2=', m.race_8ball_p2);
        console.log('  deltas: p1=', m.delta_8ball_p1, 'p2=', m.delta_8ball_p2);
        console.log('--- 9ball ---');
        console.log('  status:', m.status_9ball, 'winner:', m.winner_id_9ball);
        console.log('  scores: p1=', m.score_9ball_p1, 'p2=', m.score_9ball_p2);
        console.log('  points: p1=', m.points_9ball_p1, 'p2=', m.points_9ball_p2);
        console.log('  races: p1=', m.race_9ball_p1, 'p2=', m.race_9ball_p2);
        console.log('  deltas: p1=', m.delta_9ball_p1, 'p2=', m.delta_9ball_p2);
        console.log('--- verification ---');
        console.log('  verification_status:', m.verification_status);
        console.log('  pending_p1_submission:', JSON.stringify(m.pending_p1_submission));
        console.log('  pending_p2_submission:', JSON.stringify(m.pending_p2_submission));
    }
}
main();
