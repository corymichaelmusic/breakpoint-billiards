
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSession() {
    const sessionName = 'Spring 2026';
    const { data: leagues, error: lError } = await supabase
        .from('leagues')
        .select('id, name, status')
        .eq('name', sessionName)
        .eq('type', 'session');

    if (lError || !leagues || leagues.length === 0) {
        console.error("League not found", lError);
        return;
    }

    const league = leagues[0];
    console.log('League:', league);

    const { data: matches, error: mError } = await supabase
        .from('matches')
        .select('id, status, status_8ball, status_9ball')
        .eq('league_id', league.id);

    console.log(`Found ${matches ? matches.length : 0} matches.`);

    const matchIds = matches ? matches.map(m => m.id) : [];
    if (matchIds.length > 0) {
        const { count, error: gError } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .in('match_id', matchIds);
        console.log(`Found ${count || 0} games.`);

        const submittedMatches = matches.filter(m => m.status !== 'scheduled');
        console.log(`Found ${submittedMatches.length} matches not in 'scheduled' status.`);
    }

    const { data: players, error: pError } = await supabase
        .from('league_players')
        .select(`
            player_id,
            status,
            profiles (
                full_name,
                email
            )
        `)
        .eq('league_id', league.id);

    console.log('Players in session:', players.map(p => ({
        id: p.player_id,
        name: p.profiles?.full_name,
        status: p.status
    })));
}

inspectSession();
