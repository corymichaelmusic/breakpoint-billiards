require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data: session } = await supabase.from('leagues').select('*').ilike('name', '%Spring 2026%').single();
    if (!session) return console.log("Spring 2026 not found");
    console.log("Session:", session.id, session.name);
    
    // Find Cory's player ID
    const { data: profile } = await supabase.from('profiles').select('*').ilike('full_name', '%Cory Hinkley%').single();
    if (!profile) return console.log("Cory not found");
    
    const playerId = profile.id;
    
    const { data: matches } = await supabase.from('matches').select('*')
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .eq('league_id', session.id);
        
    console.log("Cory's matches in Spring 2026:", matches?.length);
    
    // What if we check all matches for Cory and see what leagues they are in?
    const { data: allMatches } = await supabase.from('matches').select('id, league_id, leagues(name)').or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
    console.log("Cory's total matches:", allMatches?.length);
    if(allMatches) {
        allMatches.forEach(m => console.log(`Match ${m.id} is in league ${m.league_id} (${m.leagues?.name})`));
    }
}
run();
