const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixStuckMatches() {
    console.log('Checking for matches...');

    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, status, submitted_at, current_points_p1, current_points_p2')
        .neq('status', 'finalized');

    if (error) { console.error(error); return; }

    console.log(`Found ${matches.length} matches. Checking games...`);

    // Fetch ALL games in one go if possible, or matches in chunks
    // To speed up, let's fetch games for these matches
    const matchIds = matches.map(m => m.id);
    // Chunk matchIds
    const chunkSize = 50;
    const updates = [];

    for (let i = 0; i < matchIds.length; i += chunkSize) {
        const chunk = matchIds.slice(i, i + chunkSize);
        const { data: games } = await supabase.from('games').select('match_id, score_p1, score_p2').in('match_id', chunk);
        
        // Process chunk
        for (const id of chunk) {
            const match = matches.find(m => m.id === id);
            const matchGames = games ? games.filter(g => g.match_id === id) : [];
            const hasScores = (match.current_points_p1 > 0 || match.current_points_p2 > 0) || matchGames.some(g => g.score_p1 > 0 || g.score_p2 > 0);
            
            if (hasScores) {
                 console.log(`Fixing match ${id}...`);
                 updates.push(
                     supabase.from('matches').update({
                        status: 'finalized',
                        submitted_at: new Date().toISOString()
                     }).eq('id', id)
                 );
            }
        }
    }
    
    console.log(`Running ${updates.length} updates...`);
    await Promise.all(updates);
    console.log('Done.');
}
fixStuckMatches();
