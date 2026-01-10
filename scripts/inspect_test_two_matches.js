
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspectMatches() {
    // 1. Find the league
    const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('id, name')
        .ilike('name', 'TEST TWO')
        .single();

    if (leagueError) {
        console.error('Error finding league:', leagueError);
        return;
    }

    console.log('Found League:', league);

    // 2. Get matches
    const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('league_id', league.id)
        .order('week_number', { ascending: true });

    if (matchError) {
        console.error('Error fetching matches:', matchError);
        return;
    }

    console.log(`Found ${matches.length} matches.`);
    matches.forEach(m => {
        console.log(`Week ${m.week_number}: Status=${m.status} | Scores 8B: ${m.points_8ball_p1}-${m.points_8ball_p2} | Scores 9B: ${m.points_9ball_p1}-${m.points_9ball_p2}`);
    });
}

inspectMatches();
