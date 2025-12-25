const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
console.log('Initializing Supabase client...');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('Supabase client initialized.');

async function fixStuckMatches() {
    console.log('Checking for matches that have scores but are not finalized...');

    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, status, submitted_at, player1_id, player2_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2')
        .neq('status', 'finalized');

    if (error) {
        console.error('Error fetching matches:', error);
        return;
    }

    console.log(`Found ${matches.length} non-finalized matches. Checking for scoring activity...`);

    for (const match of matches) {
        // Check if games exist
        const { data: games } = await supabase.from('games').select('*').eq('match_id', match.id);

        const hasScores = (match.current_points_p1 > 0 || match.current_points_p2 > 0) || (games && games.some(g => g.score_p1 > 0 || g.score_p2 > 0));

        if (hasScores) {
            console.log(`Match ${match.id} has scores but is status='${match.status}'`);
            console.log('Scores:', { p1: match.current_points_p1, p2: match.current_points_p2 });

            // Force finalize it?
            console.log('Finalizing match...');
            await supabase.from('matches').update({
                status: 'finalized',
                submitted_at: new Date().toISOString() // User asked to submit them
            }).eq('id', match.id);
        }
    }
    console.log('Done.');
}

fixStuckMatches();
