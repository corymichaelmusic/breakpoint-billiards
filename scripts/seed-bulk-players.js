const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function seedBulkPlayers() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Create 25 players
    const players = [];
    for (let i = 1; i <= 25; i++) {
        players.push({
            id: `player_bulk_${i}`,
            email: `player${i}@test.com`,
            full_name: `Player ${i}`,
            role: 'player'
        });
    }

    console.log('Inserting profiles...');
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert(players)
        .select();

    if (profileError) {
        console.error('Error seeding profiles:', profileError);
        return;
    }

    // 2. Add to League
    // Get the setup league
    const { data: leagues } = await supabase.from('leagues').select('id').eq('status', 'setup').limit(1);
    if (!leagues || leagues.length === 0) {
        console.log('No setup league found.');
        return;
    }
    const leagueId = leagues[0].id;

    const leaguePlayers = players.map(p => ({
        league_id: leagueId,
        player_id: p.id
    }));

    console.log(`Adding ${players.length} players to league ${leagueId}...`);
    const { error: lpError } = await supabase
        .from('league_players')
        .upsert(leaguePlayers, { onConflict: 'league_id, player_id' });

    if (lpError) {
        console.error('Error adding to league:', lpError);
    } else {
        console.log('Successfully added 25 players to the league.');
    }
}

seedBulkPlayers();
