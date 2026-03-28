const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function investigate() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Searching for players Glenn and David...");
    const { data: players, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .or('full_name.ilike.%Glenn%,full_name.ilike.%David%');

    if (pError) {
        console.error("Error fetching players:", pError);
        return;
    }

    console.log("Found players:", players);

    const playerIds = players.map(p => p.id);

    console.log("Searching for matches in Week 5 for these players...");
    const { data: matches, error: mError } = await supabase
        .from('matches')
        .select(`
            *,
            leagues(name),
            player1:player1_id(full_name),
            player2:player2_id(full_name)
        `)
        .eq('week_number', 5)
        .or(`player1_id.in.(${playerIds.join(',')}),player2_id.in.(${playerIds.join(',')})`);

    if (mError) {
        console.error("Error fetching matches:", mError);
        return;
    }

    console.log(`Found ${matches.length} matches:`);
    matches.forEach(m => {
        console.log(`\nMatch ID: ${m.id}`);
        console.log(`League: ${m.leagues?.name}`);
        console.log(`P1: ${m.player1?.full_name} (${m.player1_id})`);
        console.log(`P2: ${m.player2?.full_name} (${m.player2_id})`);
        console.log(`Status: ${m.status}`);
        console.log(`Winner ID: ${m.winner_id}`);
        console.log(`8-ball Winner ID: ${m.winner_id_8ball}`);
        console.log(`9-ball Winner ID: ${m.winner_id_9ball}`);
        console.log(`Points 8-ball: P1=${m.points_8ball_p1}, P2=${m.points_8ball_p2}`);
        console.log(`Points 9-ball: P1=${m.points_9ball_p1}, P2=${m.points_9ball_p2}`);
        console.log(`Race 8-ball: P1=${m.race_8ball_p1}, P2=${m.race_8ball_p2}`);
        console.log(`Race 9-ball: P1=${m.race_9ball_p1}, P2=${m.race_9ball_p2}`);
    });

    if (matches.length > 0) {
        const matchId = matches[0].id; // Let's look at the first one for now
        console.log(`\nFetching games for match: ${matchId}`);
        const { data: games, error: gError } = await supabase
            .from('games')
            .select('*')
            .eq('match_id', matchId)
            .order('game_number', { ascending: true });

        if (gError) {
            console.error("Error fetching games:", gError);
            return;
        }

        console.log(`Found ${games.length} games:`);
        games.forEach(g => {
            console.log(`Game ${g.game_number} (${g.game_type}): Winner=${g.winner_id}, Score P1=${g.score_p1}, P2=${g.score_p2}`);
        });
    }
}

investigate();
