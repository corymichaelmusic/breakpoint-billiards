
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillWinnerIds() {
    console.log("Backfilling missing winner IDs for 'Test Group 2'...");

    // Get league ID
    const { data: leagues } = await supabase.from('leagues').select('id').eq('name', 'Test Group 2');
    if (!leagues || leagues.length === 0) return;
    const leagueId = leagues[0].id;

    // Fetch matches
    const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('league_id', leagueId);

    if (matchError) return console.error(matchError);

    for (const m of matches) {
        if (m.winner_id) continue; // Already set

        // Calculate totals
        const p1Total = (m.points_8ball_p1 || 0) + (m.points_9ball_p1 || 0);
        const p2Total = (m.points_8ball_p2 || 0) + (m.points_9ball_p2 || 0);

        // Only set winner if match seems to have data (not 0-0)
        if (p1Total === 0 && p2Total === 0) continue;

        let winnerId = null;
        if (p1Total > p2Total) winnerId = m.player1_id;
        else if (p2Total > p1Total) winnerId = m.player2_id;

        // Also, if 8ball and 9ball are finalized, main status should be finalized?
        // Match 32 had status: scheduled but 8B/9B finalized.
        let updates = {};
        if (winnerId) {
            updates.winner_id = winnerId;
            console.log(`Setting winner for Match ${m.id} to ${winnerId} (Scores: ${p1Total}-${p2Total})`);
        }

        if (m.status_8ball === 'finalized' && m.status_9ball === 'finalized' && m.status !== 'finalized') {
            updates.status = 'finalized';
            console.log(`Setting Match ${m.id} status to finalized`);
        }

        if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('matches').update(updates).eq('id', m.id);
            if (error) console.error(`Failed to update match ${m.id}:`, error);
            else console.log(`Updated match ${m.id}`);
        }
    }
}

backfillWinnerIds();
