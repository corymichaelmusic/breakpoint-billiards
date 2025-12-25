const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getAllMatchIds(sessionIds) {
    let allIds = [];
    let from = 0;
    const limit = 1000;

    while (true) {
        const { data: matches, error } = await supabase
            .from('matches')
            .select('id')
            .in('league_id', sessionIds)
            .range(from, from + limit - 1);

        if (error) throw error;
        if (!matches || matches.length === 0) break;

        allIds = allIds.concat(matches.map(m => m.id));
        from += limit;
        if (matches.length < limit) break;
    }
    return allIds;
}

async function deleteLegacySessions() {
    console.log('Deleting sessions created before 2025-12-03...');

    // 1. Get Session IDs
    const { data: sessions, error } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('type', 'session')
        .lt('created_at', '2025-12-03T00:00:00Z');

    if (error) { console.error(error); return; }
    if (!sessions || sessions.length === 0) { console.log('No legacy sessions found.'); return; }

    const sessionIds = sessions.map(s => s.id);
    console.log(`Found ${sessions.length} sessions to delete.`);

    // 2. Get Matches (Handling Pagination)
    console.log('Fetching all match IDs...');
    const matchIds = await getAllMatchIds(sessionIds);
    console.log(`Found ${matchIds.length} total matches to delete.`);

    // Helper to chunk array
    const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

    if (matchIds.length > 0) {
        // 3. Delete Games in Chunks
        console.log('Deleting games in chunks...');
        const matchIdChunks = chunk(matchIds, 100);
        let deletedGames = 0;
        for (const ids of matchIdChunks) {
            const { error: gameError } = await supabase
                .from('games')
                .delete()
                .in('match_id', ids);
            if (gameError) console.error('Error deleting batch of games:', gameError);
            else deletedGames += ids.length; // Approximate
            // console.log(`Deleted games for batch of ${ids.length} matches...`);
        }
        console.log('Finished deleting games.');
    }

    // 4. Delete Matches
    console.log('Deleting matches...');
    // Delete by league_id is safe now that games are gone for ALL matches in those leagues
    const { error: matchDeleteError } = await supabase
        .from('matches')
        .delete()
        .in('league_id', sessionIds);

    if (matchDeleteError) {
        console.error('Error deleting matches:', matchDeleteError);
        return;
    }

    // 5. Delete League Players
    console.log('Deleting league memberships...');
    const { error: lpError } = await supabase
        .from('league_players')
        .delete()
        .in('league_id', sessionIds);

    if (lpError) { console.error('Error deleting league players:', lpError); return; }

    // 6. Delete Sessions
    console.log('Deleting sessions...');
    const { error: sessionError } = await supabase
        .from('leagues')
        .delete()
        .in('id', sessionIds);

    if (sessionError) {
        console.error('Error deleting sessions:', sessionError);
    } else {
        console.log('Successfully deleted legacy sessions.');
    }
}

deleteLegacySessions();
