
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLeaguePlayers() {
    // 1. Get the Active League ID for the user (TEST TWO)
    // We saw in previous steps it was "TEST TWO"
    // Let's just query by name to be sure or list all where matches_played > 0

    console.log("Fetching league players with stats...");

    const { data: players, error } = await supabase
        .from('league_players')
        .select(`
            player_id,
            matches_played,
            matches_won,
            shutouts,
            breakpoint_rating, 
            profiles:player_id (full_name, breakpoint_rating),
            leagues:league_id (name, status)
        `)
        .gt('matches_played', 0); // Only active ones

    if (error) {
        console.error(error);
        return;
    }

    console.log(JSON.stringify(players, null, 2));

    // Also inspect matches to see if any shutouts *should* exist
    const { data: matches } = await supabase
        .from('matches')
        .select('player1_id, player2_id, winner_id_8ball, winner_id_9ball, status_8ball, status_9ball')
        .eq('status_8ball', 'finalized')
        .eq('status_9ball', 'finalized');

    console.log("\nPotential Shutouts in Matches:");
    matches.forEach(m => {
        if (m.winner_id_8ball && m.winner_id_9ball && m.winner_id_8ball === m.winner_id_9ball) {
            console.log(`- Match Shutout! Winner: ${m.winner_id_8ball}`);
        }
    });
}

inspectLeaguePlayers();
