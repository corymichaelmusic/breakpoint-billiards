const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function investigate() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const matchId = '65ebedad-2ed9-493e-9180-b0116a12eff3';

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
    
    // Group by scorer
    const scorers = [...new Set(games.map(g => g.scored_by))];
    
    scorers.forEach(scorerId => {
        const scorerName = scorerId === 'user_39XmZOmAboWjLWia4zViNBYTv6n' ? 'Glenn' : (scorerId === 'user_39AlZQKboH2dlFhTW6bctvhnTiA' ? 'David' : scorerId);
        console.log(`\n--- Scored by: ${scorerName} ---`);
        const userGames = games.filter(g => g.scored_by === scorerId);
        
        const games8 = userGames.filter(g => g.game_type === '8ball');
        console.log(`8-ball: ${games8.length} games`);
        games8.forEach(g => {
            console.log(`  G${g.game_number} (8ball): Winner=${g.winner_id === 'user_39AlZQKboH2dlFhTW6bctvhnTiA' ? 'David' : (g.winner_id === 'user_39XmZOmAboWjLWia4zViNBYTv6n' ? 'Glenn' : g.winner_id)}, Score P1=${g.score_p1}, P2=${g.score_p2}`);
        });

        const wins8P1 = games8.filter(g => g.winner_id === 'user_39XmZOmAboWjLWia4zViNBYTv6n').length;
        const wins8P2 = games8.filter(g => g.winner_id === 'user_39AlZQKboH2dlFhTW6bctvhnTiA').length;
        console.log(`  8-ball Wins: Glenn=${wins8P1}, David=${wins8P2}`);
        
        const games9 = userGames.filter(g => g.game_type === '9ball');
        console.log(`9-ball: ${games9.length} games`);
        games9.forEach(g => {
            console.log(`  G${g.game_number} (9ball): Winner=${g.winner_id === 'user_39AlZQKboH2dlFhTW6bctvhnTiA' ? 'David' : (g.winner_id === 'user_39XmZOmAboWjLWia4zViNBYTv6n' ? 'Glenn' : g.winner_id)}, Score P1=${g.score_p1}, P2=${g.score_p2}`);
        });
        const wins9P1 = games9.filter(g => g.winner_id === 'user_39XmZOmAboWjLWia4zViNBYTv6n').length;
        const wins9P2 = games9.filter(g => g.winner_id === 'user_39AlZQKboH2dlFhTW6bctvhnTiA').length;
        console.log(`  9-ball Wins: Glenn=${wins9P1}, David=${wins9P2}`);
    });
}

investigate();
