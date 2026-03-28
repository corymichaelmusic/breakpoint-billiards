require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Configuration ---
const OLD_PLAYER_NAME = 'Carson Mills';
const NEW_PLAYER_CLERK_ID = 'user_39iAJ8txsuvlSSycKzf7s3PGA0J';
const DRY_RUN = false; // Set to false to actually execute

async function main() {
    console.log('=== Player Swap Script ===');
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '🚀 LIVE EXECUTION'}\n`);

    // 1. Find Spring 2026 league
    const { data: leagues, error: leagueErr } = await supabase
        .from('leagues')
        .select('*')
        .ilike('name', '%spring 2026%');

    if (leagueErr || !leagues?.length) {
        console.error('Could not find Spring 2026 league:', leagueErr);
        return;
    }
    const league = leagues[0];
    console.log(`✅ Found league: "${league.name}" (${league.id})`);

    // 2. Find Carson Mills (old player)
    const { data: oldPlayers, error: oldErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, breakpoint_rating')
        .ilike('full_name', `%${OLD_PLAYER_NAME}%`);

    if (oldErr || !oldPlayers?.length) {
        console.error('Could not find old player:', oldErr);
        return;
    }
    const oldPlayer = oldPlayers[0];
    console.log(`✅ Found old player: "${oldPlayer.full_name}" (${oldPlayer.id}), Rating: ${oldPlayer.breakpoint_rating}`);

    // 3. Find Jared Mitchell (new player)
    const { data: newPlayer, error: newErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, breakpoint_rating')
        .eq('id', NEW_PLAYER_CLERK_ID)
        .single();

    if (newErr || !newPlayer) {
        console.error('Could not find new player profile:', newErr);
        return;
    }
    console.log(`✅ Found new player: "${newPlayer.full_name}" (${newPlayer.id}), Rating: ${newPlayer.breakpoint_rating}`);

    // 4. Check old player's league_players entry
    const { data: oldLP, error: oldLPErr } = await supabase
        .from('league_players')
        .select('*')
        .eq('league_id', league.id)
        .eq('player_id', oldPlayer.id)
        .single();

    if (oldLPErr || !oldLP) {
        console.error('Old player not found in league_players:', oldLPErr);
        return;
    }
    console.log(`\n📊 Old player league stats being inherited:`);
    console.log(`   Matches: ${oldLP.matches_won}W - ${oldLP.matches_lost}L (${oldLP.matches_played} played)`);
    console.log(`   Racks: ${oldLP.breakpoint_racks_won}W - ${oldLP.breakpoint_racks_lost}L`);
    console.log(`   Rating: ${oldLP.breakpoint_rating}`);
    console.log(`   Shutouts: ${oldLP.shutouts || 0}`);

    // 5. Check new player doesn't already have a league_players entry
    const { data: existingNewLP } = await supabase
        .from('league_players')
        .select('*')
        .eq('league_id', league.id)
        .eq('player_id', newPlayer.id);

    if (existingNewLP?.length) {
        console.error('\n❌ ERROR: New player already has a league_players entry in this league!');
        console.log('   You would need to remove it first or merge records.');
        return;
    }

    // 6. Find future (unfinalized) matches to swap
    const { data: futureP1, error: fp1Err } = await supabase
        .from('matches')
        .select('id, week_number, player1_id, player2_id, status_8ball, status_9ball')
        .eq('league_id', league.id)
        .eq('player1_id', oldPlayer.id)
        .or('status_8ball.neq.finalized,status_8ball.is.null');

    const { data: futureP2, error: fp2Err } = await supabase
        .from('matches')
        .select('id, week_number, player1_id, player2_id, status_8ball, status_9ball')
        .eq('league_id', league.id)
        .eq('player2_id', oldPlayer.id)
        .or('status_8ball.neq.finalized,status_8ball.is.null');

    // Filter to only truly unplayed matches (both halves not finalized)
    const unfinalizedP1 = (futureP1 || []).filter(m => m.status_8ball !== 'finalized' || m.status_9ball !== 'finalized');
    const unfinalizedP2 = (futureP2 || []).filter(m => m.status_8ball !== 'finalized' || m.status_9ball !== 'finalized');

    console.log(`\n📅 Unfinalized matches to swap:`);
    console.log(`   As player1: ${unfinalizedP1.length} matches`);
    unfinalizedP1.forEach(m => console.log(`     - Week ${m.week_number} (${m.id}) 8ball:${m.status_8ball} 9ball:${m.status_9ball}`));
    console.log(`   As player2: ${unfinalizedP2.length} matches`);
    unfinalizedP2.forEach(m => console.log(`     - Week ${m.week_number} (${m.id}) 8ball:${m.status_8ball} 9ball:${m.status_9ball}`));

    // Also check already-played matches (for reference only)
    const { data: playedMatches } = await supabase
        .from('matches')
        .select('id, week_number, player1_id, player2_id, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball')
        .eq('league_id', league.id)
        .or(`player1_id.eq.${oldPlayer.id},player2_id.eq.${oldPlayer.id}`)
        .eq('status_8ball', 'finalized');

    console.log(`\n📜 Already finalized matches (will keep old player's name): ${(playedMatches || []).length}`);

    if (DRY_RUN) {
        console.log('\n🔍 DRY RUN - No changes made. Set DRY_RUN = false to execute.\n');
        return;
    }

    // === EXECUTE ===
    console.log('\n🚀 Executing swap...\n');

    // Step A: Swap league_players
    const { error: swapErr } = await supabase
        .from('league_players')
        .update({ player_id: newPlayer.id })
        .eq('league_id', league.id)
        .eq('player_id', oldPlayer.id);

    if (swapErr) {
        console.error('❌ Failed to swap league_players:', swapErr);
        return;
    }
    console.log('✅ Swapped league_players row');

    // Step B: Swap future matches where old player is player1
    for (const match of unfinalizedP1) {
        const { error } = await supabase
            .from('matches')
            .update({ player1_id: newPlayer.id })
            .eq('id', match.id);
        if (error) {
            console.error(`❌ Failed to swap match ${match.id} (player1):`, error);
        } else {
            console.log(`✅ Swapped match week ${match.week_number} (${match.id}) player1`);
        }
    }

    // Step C: Swap future matches where old player is player2
    for (const match of unfinalizedP2) {
        const { error } = await supabase
            .from('matches')
            .update({ player2_id: newPlayer.id })
            .eq('id', match.id);
        if (error) {
            console.error(`❌ Failed to swap match ${match.id} (player2):`, error);
        } else {
            console.log(`✅ Swapped match week ${match.week_number} (${match.id}) player2`);
        }
    }

    console.log('\n🎉 Player swap complete!');
    console.log(`   ${oldPlayer.full_name} → ${newPlayer.full_name}`);
    console.log(`   ${newPlayer.full_name} inherits: ${oldLP.matches_won}W-${oldLP.matches_lost}L record`);
    console.log(`   ${unfinalizedP1.length + unfinalizedP2.length} future matches reassigned`);
}

main().catch(console.error);
