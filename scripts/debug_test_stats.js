
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLeagueData() {
    // 1. Find League 'Test Two'
    const { data: leagues } = await supabase.from('leagues').select('id, name').ilike('name', '%Test Two%');
    
    if (!leagues || leagues.length === 0) {
        console.log("No league found.");
        return;
    }
    const leagueId = leagues[0].id; // Use first match
    console.log(`Checking League: ${leagues[0].name} (${leagueId})`);

    // 2. Fetch Matches
    const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('league_id', leagueId);

    console.log(`Found ${matches.length} matches.`);

    for (const m of matches) {
        console.log(`\nMatch (Wk ${m.week_number}): Status=${m.status}, Winner=${m.winner_id}, P1=${m.points_8ball_p1}/${m.points_9ball_p1}, P2=${m.points_8ball_p2}/${m.points_9ball_p2}`);
        
        // 3. Fetch Games for this match
        const { data: games } = await supabase.from('games').select('*').eq('match_id', m.id);
        if (games && games.length > 0) {
            console.log(`  - Has ${games.length} games linked.`);
            games.forEach(g => {
                console.log(`    Game ${g.game_number}: Type=${g.game_type}, Winner=${g.winner_id}, B&R=${g.is_break_and_run}`);
            });
        } else {
            console.log("  - NO games linked.");
        }
    }
}

inspectLeagueData();
