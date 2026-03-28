const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkDetails() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const matchId = '65ebedad-2ed9-493e-9180-b0116a12eff3';

    console.log(`Checking details for match: ${matchId}`);
    const { data: match, error: mError } = await supabase
        .from('matches')
        .select('*, player1:player1_id(*), player2:player2_id(*), league:league_id(*)')
        .eq('id', matchId)
        .single();

    if (mError) {
        console.error("Error fetching match:", mError);
        return;
    }

    console.log("\n--- Match ---");
    console.log(`Status: ${match.status}`);
    console.log(`8ball status: ${match.status_8ball}, winner: ${match.winner_id_8ball}`);
    console.log(`9ball status: ${match.status_9ball}, winner: ${match.winner_id_9ball}`);
    console.log(`P1: ${match.player1.full_name}, P2: ${match.player2.full_name}`);
    console.log(`Races in DB: 8ball P1=${match.race_8ball_p1}, P2=${match.race_8ball_p2}`);

    console.log("\n--- Player Ratings in League ---");
    const { data: lp1 } = await supabase
        .from('league_players')
        .select('*')
        .eq('league_id', match.league_id)
        .eq('player_id', match.player1_id)
        .single();
    
    const { data: lp2 } = await supabase
        .from('league_players')
        .select('*')
        .eq('league_id', match.league_id)
        .eq('player_id', match.player2_id)
        .single();

    console.log(`${match.player1.full_name}: Rating=${lp1?.breakpoint_rating}, Racks Played=${lp1?.breakpoint_racks_played}`);
    console.log(`${match.player2.full_name}: Rating=${lp2?.breakpoint_rating}, Racks Played=${lp2?.breakpoint_racks_played}`);

    console.log("\n--- Calculating Race Targets using get_race_target RPC ---");
    const { data: race8, error: r8Error } = await supabase.rpc('get_race_target', {
        p_rating1: lp1?.breakpoint_rating || 500,
        p_rating2: lp2?.breakpoint_rating || 500,
        p_game_type: '8ball'
    });
    console.log("8ball race targets:", race8);

    const { data: race9, error: r9Error } = await supabase.rpc('get_race_target', {
        p_rating1: lp1?.breakpoint_rating || 500,
        p_rating2: lp2?.breakpoint_rating || 500,
        p_game_type: '9ball'
    });
    console.log("9ball race targets:", race9);
}

checkDetails();
