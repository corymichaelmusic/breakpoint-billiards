const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseKey ? supabaseKey.length : 0);

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    console.log('Testing query...');

    // 1. Fetch one match
    const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('id, league_id')
        .limit(1);

    if (matchError) {
        console.error('Match fetch error:', matchError);
        return;
    }

    if (!matches || matches.length === 0) {
        console.log('No matches found to test with.');
        return;
    }

    const matchId = matches[0].id;
    console.log('Testing games fetch for match:', matchId);

    // 2. Fetch games directly for this match
    const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .eq('match_id', matchId);

    if (gamesError) {
        console.error('Games direct fetch error:', gamesError);
    } else {
        console.log('Games fetched directly (count):', games?.length);
        if (games?.length > 0) {
            console.log('Sample game:', JSON.stringify(games[0], null, 2));
        }
    }

    // 3. Fetch via relation
    console.log('Testing relation fetch...');
    const { data: matchWithGames, error: relError } = await supabase
        .from('matches')
        .select(`
      id,
      games(winner_id, is_break_and_run, is_9_on_snap, game_type)
    `)
        .eq('id', matchId)
        .single();

    if (relError) {
        console.error('Relation fetch error:', relError);
    } else {
        console.log('Relation fetch success. Games count:', matchWithGames.games ? matchWithGames.games.length : 'N/A');
    }
}

testQuery();
