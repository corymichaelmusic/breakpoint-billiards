
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetSession() {
    const sessionId = '2b08d033-f2cd-47cc-b6d8-78544a5df684';
    const sessionName = 'Spring 2026';

    console.log(`Resetting session: ${sessionName} (${sessionId})`);

    // 0. Get match IDs
    const { data: matches, error: fetchError } = await supabase
        .from('matches')
        .select('id')
        .eq('league_id', sessionId);

    if (fetchError) {
        console.error('Error fetching matches:', fetchError);
        return;
    }

    const matchIds = matches.map(m => m.id);
    console.log(`Found ${matchIds.length} matches to clean up.`);

    if (matchIds.length > 0) {
        // 1. Delete reschedule requests
        const { error: rrError } = await supabase
            .from('reschedule_requests')
            .delete()
            .in('match_id', matchIds);

        if (rrError) {
            console.error('Error deleting reschedule_requests:', rrError);
            return;
        }
        console.log('Reschedule requests deleted.');

        // 2. Delete games (just in case they exist, though previous check said 0)
        const { error: gamesError } = await supabase
            .from('games')
            .delete()
            .in('match_id', matchIds);

        if (gamesError) {
            console.error('Error deleting games:', gamesError);
            return;
        }
        console.log('Games deleted.');

        // 3. Delete matches
        const { error: matchError } = await supabase
            .from('matches')
            .delete()
            .eq('league_id', sessionId);

        if (matchError) {
            console.error('Error deleting matches:', matchError);
            return;
        }
        console.log('Matches deleted.');
    }

    // 4. Update league status to 'setup'
    const { error: leagueError } = await supabase
        .from('leagues')
        .update({ status: 'setup', reset_requested: false })
        .eq('id', sessionId);

    if (leagueError) {
        console.error('Error updating league status:', leagueError);
        return;
    }
    console.log('League status updated to setup.');

    // 5. Verify
    const { data: league, error: verifyError } = await supabase
        .from('leagues')
        .select('status, name')
        .eq('id', sessionId)
        .single();

    const { count: finalMatchCount } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', sessionId);

    console.log('Verification:');
    console.log('League Status:', league?.status);
    console.log('Match Count:', finalMatchCount);

    if (league?.status === 'setup' && (finalMatchCount === 0 || finalMatchCount === null)) {
        console.log('SUCCESS: Session reset successfully.');
    } else {
        console.error('FAILURE: Session reset failed or incomplete.');
    }
}

resetSession();
