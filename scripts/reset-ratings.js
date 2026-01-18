const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SESSION_ID = '2262a1ef-a44a-4172-a595-f6848d9328de';
const P1_ID = 'user_38GKAWlAxWgwMuoirhNpUxHRwWM';
const P2_ID = 'user_36tmOnpPJPGCTqGQ523h99I76CZ';

async function recalculateRatings() {
    console.log('=== Recalculating Breakpoint Ratings ===\n');

    // Get week 9 match
    const { data: week9Match, error: matchErr } = await supabase
        .from('matches')
        .select('id, player1_id, player2_id')
        .eq('league_id', SESSION_ID)
        .eq('week_number', 9)
        .single();

    if (matchErr || !week9Match) {
        console.log('No week 9 match found:', matchErr);
        return;
    }

    console.log('Week 9 match ID:', week9Match.id);

    // Get all games from week 9 match sorted by game_number
    const { data: week9Games, error: gamesErr } = await supabase
        .from('games')
        .select('bbrs_player1_rating_start, bbrs_player2_rating_start, bbrs_delta_scaled, winner_id, game_number')
        .eq('match_id', week9Match.id)
        .order('game_number', { ascending: true });

    if (gamesErr) {
        console.log('Error fetching games:', gamesErr);
        return;
    }

    console.log('Found', week9Games.length, 'games in week 9\n');

    // Calculate final ratings by applying deltas
    // Start with the rating from game 1, then apply all deltas
    let p1Rating = week9Games[0].bbrs_player1_rating_start;
    let p2Rating = week9Games[0].bbrs_player2_rating_start;

    console.log('Starting ratings: P1 =', p1Rating, ', P2 =', p2Rating);

    for (const game of week9Games) {
        const delta = game.bbrs_delta_scaled || 0;
        const p1Won = game.winner_id === week9Match.player1_id;

        // If P1 won, they get + delta, P2 gets - delta
        // If P2 won, P2 gets + delta, P1 gets - delta
        // Delta is typically negative if the expected player lost
        if (p1Won) {
            p1Rating += Math.abs(delta);
            p2Rating -= Math.abs(delta);
        } else {
            p2Rating += Math.abs(delta);
            p1Rating -= Math.abs(delta);
        }

        console.log('Game', game.game_number, ': Winner =', game.winner_id.slice(-8), ', Delta =', delta, '-> P1:', Math.round(p1Rating), 'P2:', Math.round(p2Rating));
    }

    // Map back to user IDs
    const isP1InMatchPlayer1 = week9Match.player1_id === P1_ID;
    const p1FinalRating = isP1InMatchPlayer1 ? p1Rating : p2Rating;
    const p2FinalRating = isP1InMatchPlayer1 ? p2Rating : p1Rating;

    console.log('\n=== FINAL RATINGS AFTER WEEK 9 ===');
    console.log('  P1 (pUxHRwWM):', Math.round(p1FinalRating));
    console.log('  P2 (h99I76CZ):', Math.round(p2FinalRating));

    // Update profiles
    await supabase.from('profiles').update({ breakpoint_rating: p1FinalRating }).eq('id', P1_ID);
    console.log('\nUpdated P1 profile');
    await supabase.from('profiles').update({ breakpoint_rating: p2FinalRating }).eq('id', P2_ID);
    console.log('Updated P2 profile');

    // Update league_players
    await supabase.from('league_players').update({
        breakpoint_rating: p1FinalRating,
        breakpoint_racks_played: 104 // 104 games total in weeks 1-9
    }).eq('player_id', P1_ID).eq('league_id', SESSION_ID);
    console.log('Updated P1 league_players');

    await supabase.from('league_players').update({
        breakpoint_rating: p2FinalRating,
        breakpoint_racks_played: 104
    }).eq('player_id', P2_ID).eq('league_id', SESSION_ID);
    console.log('Updated P2 league_players');

    console.log('\n=== Ratings recalculated! ===');
}

recalculateRatings();
