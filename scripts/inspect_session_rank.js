const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSessionRank() {
    const userId = "user_2p0l5CAJ5Q3t6e3f8x9zC7u4q1"; // CM User ID from previous context if available, or fetch all
    // Let's just fetch all league_players for a known league or just list them to see what's up.

    console.log("Fetching league players...");

    // 1. Get User's Active League(s)
    const { data: myLeagues, error: lError } = await supabase
        .from('league_players')
        .select('league_id, player_id, matches_played, matches_won')
        .limit(20);

    if (lError) {
        console.error("Error fetching my leagues:", lError);
        return;
    }

    console.log("Sample League Players Data:", myLeagues);

    if (myLeagues.length === 0) {
        console.log("No league players found.");
        return;
    }

    // Pick a league ID from the sample to inspect leaderboard
    const leagueId = myLeagues[0].league_id;
    console.log(`\nInspecting Leaderboard for League: ${leagueId}`);

    const { data: allPlayers, error: pError } = await supabase
        .from('league_players')
        .select('player_id, matches_played, matches_won')
        .eq('league_id', leagueId);

    if (pError) {
        console.error("Error fetching leaderboard:", pError);
        return;
    }

    const sorted = allPlayers.map(p => ({
        id: p.player_id,
        winRate: p.matches_played > 0 ? (p.matches_won / p.matches_played) : 0,
        ...p
    })).sort((a, b) => b.winRate - a.winRate);

    console.log("Calculated Leaderboard:", sorted);
}

inspectSessionRank();
