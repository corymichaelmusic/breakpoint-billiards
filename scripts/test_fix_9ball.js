const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function verify() {
    try {
        const { data: matches } = await supabase.from('matches').select('id, player1:player1_id(id, full_name), player2:player2_id(id, full_name), points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, race_8ball_p1, race_8ball_p2, race_9ball_p1, race_9ball_p2');

        const target = matches.find(m => (m.player1?.full_name?.includes('Michael') && m.player2?.full_name?.includes('Carson')) || (m.player2?.full_name?.includes('Michael') && m.player1?.full_name?.includes('Carson')));

        if (!target) {
            console.log('Match not found');
            return;
        }

        console.log('Before Fix:', {
            id: target.id,
            p1: target.player1?.full_name,
            p2: target.player2?.full_name,
            p1_score: target.points_9ball_p1,
            p2_score: target.points_9ball_p2,
            race1: target.race_9ball_p1,
            race2: target.race_9ball_p2,
            winner_id: target.winner_id_9ball,
            status: target.status_9ball
        });

        // Un-finalize
        await supabase.from('matches').update({ status_9ball: 'in_progress', winner_id_9ball: null }).eq('id', target.id);

        console.log('Calling finalize_match_stats...');
        const params = {
            p_match_id: target.id,
            p_game_type: '9ball',
            p_winner_id: '',
            p_p1_racks_won: target.points_9ball_p1,
            p_p1_racks_lost: target.points_9ball_p2,
            p_p2_racks_won: target.points_9ball_p2,
            p_p2_racks_lost: target.points_9ball_p1,
            p_p1_delta: 0,
            p_p2_delta: 0,
            p_p1_break_runs: 0,
            p_p1_rack_runs: 0,
            p_p1_snaps: 0,
            p_p1_early_8s: 0,
            p_p2_break_runs: 0,
            p_p2_rack_runs: 0,
            p_p2_snaps: 0,
            p_p2_early_8s: 0
        };
        const { error } = await supabase.rpc('finalize_match_stats', params);

        if (error) {
            console.error('RPC Error:', error);
            return;
        }

        const { data: updated } = await supabase.from('matches').select('id, player1:player1_id(id, full_name), player2:player2_id(id, full_name), status_9ball, winner_id_9ball').eq('id', target.id).single();

        console.log('After Fix - Winner ID:', updated.winner_id_9ball);
        console.log('Player 1 ID:', updated.player1.id, updated.player1.full_name);
        console.log('Player 2 ID:', updated.player2.id, updated.player2.full_name);

        const mikeWon = (updated.winner_id_9ball === updated.player1.id && updated.player1.full_name.includes('Michael')) || (updated.winner_id_9ball === updated.player2.id && updated.player2.full_name.includes('Michael'));
        console.log('Success (Mike is Winner):', mikeWon);
    } catch (e) {
        console.error(e);
    }
}

verify();
