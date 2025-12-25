
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillSubMatchWinners() {
    console.log('Fetching finalized matches...');

    let allMatches = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data: matches, error } = await supabase
            .from('matches')
            .select('*')
            .eq('status', 'finalized')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching matches:', error);
            return;
        }

        if (matches.length < pageSize) {
            hasMore = false;
        }

        allMatches = allMatches.concat(matches);
        page++;
        console.log(`Fetched page ${page}, total matches: ${allMatches.length}`);
    }

    const matches = allMatches;
    console.log(`Found ${matches.length} matches to check.`);

    for (const match of matches) {
        const updates = {};

        const isDebug = match.id === '1c5c9dc0-87c4-4738-9087-84c768c97e12';
        if (isDebug) console.log('DEBUG MATCH FOUND:', match);

        // Check 8-Ball
        if (match.status_8ball === 'finalized' && !match.winner_id_8ball) {
            const p1 = match.points_8ball_p1 || 0;
            const p2 = match.points_8ball_p2 || 0;
            const r1 = match.race_8ball_p1 || 0;
            const r2 = match.race_8ball_p2 || 0;

            // If races are 0/null, assume standard win by points if significantly different, or try games
            let winner = null;

            if (p1 >= r1 && p2 >= r2 && r1 > 0 && r2 > 0) {
                // Real "both over limit" case
                if (isDebug) console.log(`Match ${match.id} (8-Ball): Both over limit (${p1}/${r1} vs ${p2}/${r2}). Fetching games...`);
                winner = await getLastGameWinner(match.id, '8ball');
                if (isDebug) console.log('Winner from games:', winner);
            }

            // Fallback or standard case
            if (!winner) {
                if (p1 > p2) winner = match.player1_id;
                else if (p2 > p1) winner = match.player2_id;
                if (isDebug) console.log('Winner from points:', winner);
            }

            if (winner) updates.winner_id_8ball = winner;
        }

        // Check 9-Ball
        if (match.status_9ball === 'finalized' && !match.winner_id_9ball) {
            const p1 = match.points_9ball_p1 || 0;
            const p2 = match.points_9ball_p2 || 0;
            const r1 = match.race_9ball_p1 || 0;
            const r2 = match.race_9ball_p2 || 0;

            let winner = null;

            if (p1 >= r1 && p2 >= r2 && r1 > 0 && r2 > 0) {
                if (isDebug) console.log(`Match ${match.id} (9-Ball): Both over limit (${p1}/${r1} vs ${p2}/${r2}). Fetching games...`);
                winner = await getLastGameWinner(match.id, '9ball');
                if (isDebug) console.log('Winner from games:', winner);
            }

            if (!winner) {
                if (p1 > p2) winner = match.player1_id;
                else if (p2 > p1) winner = match.player2_id;
                if (isDebug) console.log('Winner from points:', winner);
            }

            if (winner) updates.winner_id_9ball = winner;
        }

        if (Object.keys(updates).length > 0) {
            if (isDebug) console.log(`Updating Match ${match.id}:`, updates);
            const { error: updateError } = await supabase
                .from('matches')
                .update(updates)
                .eq('id', match.id);

            if (updateError) console.error(`Failed to update match ${match.id}:`, updateError);
        }
    }

    console.log('Done!');
}

async function getLastGameWinner(matchId, gameType) {
    const { data: games } = await supabase
        .from('games')
        .select('*')
        .eq('match_id', matchId)
        .eq('game_type', gameType)
        .order('game_number', { ascending: false })
        .limit(1);

    if (games && games.length > 0) {
        return games[0].winner_id;
    }
    return null;
}

backfillSubMatchWinners();
