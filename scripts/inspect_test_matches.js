
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectMatches() {
    // 1. Find League ID
    const { data: leagues, error: leagueError } = await supabase
        .from('leagues')
        .select('id, name, type')
        .ilike('name', '%Test Two%');

    if (leagueError) {
        console.error("Error finding league:", leagueError);
        return;
    }

    if (!leagues || leagues.length === 0) {
        console.log("No league found with name 'Test Two'");
        return;
    }

    console.log("Found Leagues:", leagues);

    const leagueId = leagues[0].id; // Assumption

    // 2. Fetch Matches
    const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select(`
            id, 
            week_number,
            status, 
            winner_id,
            player1_id,
            player2_id,
            points_8ball_p1
        `)
        .eq('league_id', leagueId);

    if (matchError) {
        console.error("Error fetching matches:", matchError);
        return;
    }

    console.log(`Found ${matches.length} matches for League ${leagueId}:`);
    matches.forEach(m => {
        console.log(`- wk${m.week_number}: Status=${m.status}, Winner=${m.winner_id}`);
    });
}

inspectMatches();
