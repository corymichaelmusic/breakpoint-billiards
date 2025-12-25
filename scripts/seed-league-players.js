const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function seedLeaguePlayers() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Get the first league (created by operator)
    const { data: leagues } = await supabase.from('leagues').select('id').limit(1);
    if (!leagues || leagues.length === 0) {
        console.log('No leagues found. Please create a league first.');
        return;
    }
    const leagueId = leagues[0].id;

    // 2. Get all test players
    const { data: players } = await supabase.from('profiles').select('id').eq('role', 'player');

    if (!players || players.length === 0) {
        console.log('No players found.');
        return;
    }

    // 3. Add them to the league
    const leaguePlayers = players.map(p => ({
        league_id: leagueId,
        player_id: p.id
    }));

    const { data, error } = await supabase
        .from('league_players')
        .upsert(leaguePlayers, { onConflict: 'league_id, player_id' })
        .select();

    if (error) {
        console.error('Error adding players to league:', error);
    } else {
        console.log(`Successfully added ${data.length} players to league ${leagueId}`);
    }

    // 4. Set league to 'setup' status
    await supabase.from('leagues').update({ status: 'setup' }).eq('id', leagueId);
    console.log('Set league status to setup');
}

seedLeaguePlayers();
