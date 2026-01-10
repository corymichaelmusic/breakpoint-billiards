require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    // 1. Get the League (Org) ID for "Breakpoint Billiard's League" (or similar from screenshot)
    const { data: leagues, error: lErr } = await supabase
        .from('leagues')
        .select('*')
        .eq('type', 'league')
        .limit(1);

    if (lErr || !leagues.length) {
        console.error('League not found', lErr);
        return;
    }

    const orgId = leagues[0].id;
    console.log('Org ID:', orgId, 'Name:', leagues[0].name);

    // 2. Get Sessions for this Org
    const { data: sessions, error: sErr } = await supabase
        .from('leagues')
        .select('id, name, parent_league_id')
        .eq('parent_league_id', orgId);

    if (sErr) console.error('Session Error', sErr);
    console.log('Sessions Found:', sessions?.length);
    sessions?.forEach(s => console.log(` - Session: ${s.name} (${s.id})`));

    const sessionIds = sessions?.map(s => s.id) || [];
    const allLeagueIds = [orgId, ...sessionIds];

    // 3. Get Players in these leagues
    const { data: players, error: pErr } = await supabase
        .from('league_players')
        .select('player_id, league_id, leagues(name), profiles(full_name)')
        .in('league_id', allLeagueIds);

    if (pErr) console.error('Players Error', pErr);

    console.log('\n--- Player Rows (Raw) ---');
    players?.forEach(p => {
        console.log(`Player: ${p.profiles?.full_name}, League: ${p.leagues?.name} (${p.league_id})`);
    });

}

inspect();
