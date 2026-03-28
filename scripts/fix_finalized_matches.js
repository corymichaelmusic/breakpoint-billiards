require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const OLD_PLAYER_ID = 'user_39ljU8svOLfZpKZKJUvDZYC0vlz'; // Carson Mills
const NEW_PLAYER_ID = 'user_39iAJ8txsuvlSSycKzf7s3PGA0J'; // Jared Mitchell
const LEAGUE_ID = '2b08d033-f2cd-47cc-b6d8-78544a5df684';  // Spring 2026

async function main() {
    console.log('=== Fixing Finalized Match Ownership ===\n');

    // 1. Find all finalized matches where Carson was player1 or player2
    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, week_number, player1_id, player2_id, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball')
        .eq('league_id', LEAGUE_ID)
        .or(`player1_id.eq.${OLD_PLAYER_ID},player2_id.eq.${OLD_PLAYER_ID}`);

    if (error) {
        console.error('Error fetching matches:', error);
        return;
    }

    const finalizedMatches = matches.filter(m => 
        m.status_8ball === 'finalized' || m.status_9ball === 'finalized'
    );

    console.log(`Found ${finalizedMatches.length} finalized matches to update\n`);

    for (const match of finalizedMatches) {
        const updates = {};
        
        // Swap player IDs
        if (match.player1_id === OLD_PLAYER_ID) {
            updates.player1_id = NEW_PLAYER_ID;
        }
        if (match.player2_id === OLD_PLAYER_ID) {
            updates.player2_id = NEW_PLAYER_ID;
        }
        
        // Swap winner IDs
        if (match.winner_id_8ball === OLD_PLAYER_ID) {
            updates.winner_id_8ball = NEW_PLAYER_ID;
        }
        if (match.winner_id_9ball === OLD_PLAYER_ID) {
            updates.winner_id_9ball = NEW_PLAYER_ID;
        }

        if (Object.keys(updates).length > 0) {
            const { error: updateErr } = await supabase
                .from('matches')
                .update(updates)
                .eq('id', match.id);

            if (updateErr) {
                console.error(`❌ Week ${match.week_number} (${match.id}):`, updateErr);
            } else {
                console.log(`✅ Week ${match.week_number} (${match.id}): Updated ${Object.keys(updates).join(', ')}`);
            }
        }
    }

    // 2. Also update submitted_by if Carson submitted any matches
    const { data: submittedMatches } = await supabase
        .from('matches')
        .select('id, week_number')
        .eq('league_id', LEAGUE_ID)
        .eq('submitted_by', OLD_PLAYER_ID);

    if (submittedMatches?.length) {
        for (const m of submittedMatches) {
            await supabase.from('matches').update({ submitted_by: NEW_PLAYER_ID }).eq('id', m.id);
            console.log(`✅ Updated submitted_by for Week ${m.week_number}`);
        }
    }

    // 3. Update games table - winner_id and submitted_by
    const { data: games } = await supabase
        .from('games')
        .select('id, match_id, winner_id, submitted_by')
        .in('match_id', finalizedMatches.map(m => m.id))
        .or(`winner_id.eq.${OLD_PLAYER_ID},submitted_by.eq.${OLD_PLAYER_ID}`);

    if (games?.length) {
        console.log(`\nFound ${games.length} game records to update`);
        for (const game of games) {
            const gUpdates = {};
            if (game.winner_id === OLD_PLAYER_ID) gUpdates.winner_id = NEW_PLAYER_ID;
            if (game.submitted_by === OLD_PLAYER_ID) gUpdates.submitted_by = NEW_PLAYER_ID;
            
            if (Object.keys(gUpdates).length > 0) {
                await supabase.from('games').update(gUpdates).eq('id', game.id);
            }
        }
        console.log(`✅ Updated ${games.length} game records`);
    }

    // 4. Reset confidence score (breakpoint_racks_played) to 0
    const { error: confErr } = await supabase
        .from('league_players')
        .update({ breakpoint_racks_played: 0 })
        .eq('league_id', LEAGUE_ID)
        .eq('player_id', NEW_PLAYER_ID);

    if (confErr) {
        console.error('❌ Failed to reset confidence score:', confErr);
    } else {
        console.log('\n✅ Reset confidence score (breakpoint_racks_played) to 0');
    }

    console.log('\n🎉 Done! Jared\'s dashboard should now show the inherited record and stats.');
}

main().catch(console.error);
