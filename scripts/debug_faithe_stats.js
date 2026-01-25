
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log('Searching for Faithe Newcomb...');
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%Faithe Newcomb%');

    if (profileError) {
        console.error('Profile Error:', profileError);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('No profile found for Faithe Newcomb');

        // List some profiles to see if we can find any
        const { data: someProfiles } = await supabase.from('profiles').select('full_name').limit(5);
        console.log('Sample profiles:', someProfiles);
        return;
    }

    console.log(`Found ${profiles.length} profile(s)`);
    const player = profiles[0];
    console.log('Player:', player);

    // Find active leagues/sessions
    const { data: memberships, error: memberError } = await supabase
        .from('league_players')
        .select('league_id, status, leagues(id, name, type)')
        .eq('player_id', player.id);

    if (memberError) {
        console.error('Membership Error:', memberError);
        return;
    }

    console.log('Memberships:', JSON.stringify(memberships, null, 2));

    if (memberships.length === 0) {
        console.log("Player has no memberships.");
        return;
    }

    const session = memberships.find(m => m.leagues.type === 'session' || m.leagues.type === 'league');
    // if (!session) {
    //     console.log("No session/league found.");
    //     return;
    // }

    // const sessionId = session.league_id;

    // Let's check ALL memberships IDs
    for (const m of memberships) {
        const targetId = m.league_id;
        const targetName = m.leagues.name;
        const targetType = m.leagues.type;

        console.log(`\nChecking Stats for ${targetType}: ${targetName} (${targetId})`);

        const { data: matches, error: matchError } = await supabase
            .from("matches")
            .select(`
                  id, status, winner_id, player1_id, player2_id
              `)
            .eq("league_id", targetId)
            .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`);

        if (matchError) {
            console.log("Match Query Error:", matchError);
            continue;
        }

        console.log(`Found ${matches.length} matches in this ${targetType}.`);
    }

    return; // Stop here for now

    /*
    console.log(`Checking Stats for Session: ${session.leagues.name} (${sessionId})`);

    // Query Matches like `getPlayerSessionStats`
    const { data: matches, error: matchError } = await supabase
        .from("matches")
        .select(`
            id,
            status,
            winner_id,
            player1_id,
            player2_id,
            points_8ball_p1, points_8ball_p2,
            points_9ball_p1, points_9ball_p2,
            winner_id_8ball, winner_id_9ball,
            status_8ball, status_9ball,
            is_forfeit
        `)
        .eq("league_id", sessionId)
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`);

    if (matchError) {
        console.log("Match Query Error:", matchError);
        return;
    }
    */

    console.log(`Found ${matches.length} matches in this session.`);
    if (matches.length > 0) {
        console.log("Sample Match:", matches[0]);
    } else {
        console.log("No matches found using the query logic.");
        // check if there are ANY matches for this league
        const { count } = await supabase.from('matches').select('*', { count: 'exact', head: true }).eq('league_id', sessionId);
        console.log(`Total matches in league ${sessionId}: ${count}`);
    }

    // Check Games
    if (matches.length > 0) {
        const matchId = matches[0].id;
        const { data: games } = await supabase.from('games').select('*').eq('match_id', matchId);
        console.log(`Found ${games.length} games for match ${matchId}`);
        if (games.length > 0) console.log("Sample Game:", games[0]);
    }
}

run();
