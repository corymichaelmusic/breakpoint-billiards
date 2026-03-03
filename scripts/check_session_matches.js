const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: session } = await supabase.from('leagues').select('*').ilike('name', '%Spring 2026%').single();
    if (!session) return console.log("Spring 2026 not found");
    console.log("Session:", session.id, session.name);

    // Find Cory's player ID
    const { data: profile } = await supabase.from('profiles').select('*').ilike('full_name', '%Cory Hinkley%').single();
    if (!profile) return console.log("Cory not found");

    const playerId = profile.id;

    const { data: matches } = await supabase.from('matches').select('id, league_id')
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .eq('league_id', session.id);

    console.log(`Cory's matches in Spring 2026: ${matches ? matches.length : 0}`);

    // What if we check all matches for Cory and see what leagues they are in?
    const { data: allMatches } = await supabase.from('matches').select('id, league_id, leagues(name)').or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
    console.log(`Cory's total matches: ${allMatches ? allMatches.length : 0}`);
    if (allMatches) {
        allMatches.forEach(m => console.log(`Match ${m.id} is in league ${m.league_id} (${m.leagues?.name})`));
    }
}
run();
