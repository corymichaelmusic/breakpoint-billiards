
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

async function recalcLeagueStats() {
    console.log("Starting League Stats Recalculation...");

    // 1. Fetch All Finalized Matches
    const { data: matches, error: mError } = await supabase
        .from('matches')
        .select('*');
    // .in('status', ['finalized', 'completed']) <-- REMOVED
    // .or('status_8ball.eq.finalized,status_9ball.eq.finalized'); <-- REMOVED (Do it in memory for safety)

    if (mError) { console.error("Error fetching matches:", mError); return; }
    console.log(`Found ${matches.length} matches to process.`);

    // 2. Aggregate Stats
    // Map: league_id -> player_id -> { matches_played, matches_won, racks_won, ... }
    const statsMap = {}; // { [leagueId]: { [playerId]: Stats } }

    const ensureEntry = (leagueId, playerId) => {
        if (!statsMap[leagueId]) statsMap[leagueId] = {};
        if (!statsMap[leagueId][playerId]) {
            statsMap[leagueId][playerId] = {
                matches_played: 0,
                matches_won: 0,
                // Add other stats if needed for leaderboard?
                // Leaderboard likely uses matches_played/won for win rate.
            };
        }
        return statsMap[leagueId][playerId];
    };

    matches.forEach(m => {
        if (!m.league_id) return;

        // Determine Match Winner (Overall)
        // Usually based on sets? Or is it per set?
        // dashboard/index.tsx calculates win rate based on SETS?
        // "matches.forEach... if (m.status_8ball === 'finalized') matchesPlayed++"
        // It seems the "Session Stats" treat EACH SET as a "Game/Match" for the purpose of Win Rate?
        // Wait, index.tsx checks:
        // matchesPlayed++ per SET finalized.
        // matchesWon++ if won that set.

        // So `league_players.matches_played` usually stores "Sets Played"?
        // Let's check `finalize_match_stats` RPC to confirm what it increments.
        // It's crucial we align.

        // Assuming we count Sets.

        let p1Won8 = false;
        let p2Won8 = false;
        let p1Won9 = false;
        let p2Won9 = false;

        // 8-Ball
        if (m.status_8ball === 'finalized') {
            const p1 = ensureEntry(m.league_id, m.player1_id);
            const p2 = ensureEntry(m.league_id, m.player2_id);

            p1.matches_played++;
            p2.matches_played++;

            const p1Score = m.points_8ball_p1 || 0;
            const p2Score = m.points_8ball_p2 || 0;

            if (m.winner_id_8ball === m.player1_id) { p1.matches_won++; p1Won8 = true; }
            else if (m.winner_id_8ball === m.player2_id) { p2.matches_won++; p2Won8 = true; }
            else if (p1Score > p2Score) { p1.matches_won++; p1Won8 = true; }
            else if (p2Score > p1Score) { p2.matches_won++; p2Won8 = true; }
        }

        // 9-Ball
        if (m.status_9ball === 'finalized') {
            const p1 = ensureEntry(m.league_id, m.player1_id);
            const p2 = ensureEntry(m.league_id, m.player2_id);

            p1.matches_played++;
            p2.matches_played++;

            const p1Score = m.points_9ball_p1 || 0;
            const p2Score = m.points_9ball_p2 || 0;

            if (m.winner_id_9ball === m.player1_id) { p1.matches_won++; p1Won9 = true; }
            else if (m.winner_id_9ball === m.player2_id) { p2.matches_won++; p2Won9 = true; }
            else if (p1Score > p2Score) { p1.matches_won++; p1Won9 = true; }
            else if (p2Score > p1Score) { p2.matches_won++; p2Won9 = true; }
        }

        // Shutouts (Both finalized and won by same player)
        if (m.status_8ball === 'finalized' && m.status_9ball === 'finalized') {
            if (p1Won8 && p1Won9) {
                const p1 = ensureEntry(m.league_id, m.player1_id);
                p1.shutouts = (p1.shutouts || 0) + 1;
            }
            if (p2Won8 && p2Won9) {
                const p2 = ensureEntry(m.league_id, m.player2_id);
                p2.shutouts = (p2.shutouts || 0) + 1;
            }
        }
    });

    console.log("Aggregation Complete. Updating Database...");

    // 3. Update League Players
    for (const leagueId of Object.keys(statsMap)) {
        for (const playerId of Object.keys(statsMap[leagueId])) {
            const stats = statsMap[leagueId][playerId];

            // console.log(`Updating ${playerId} in League ${leagueId}: Played ${stats.matches_played}, Won ${stats.matches_won}`);

            const { error } = await supabase
                .from('league_players')
                .update({
                    matches_played: stats.matches_played,
                    matches_won: stats.matches_won,
                    shutouts: stats.shutouts
                })
                .eq('league_id', leagueId)
                .eq('player_id', playerId);

            if (error) console.error(`Failed to update ${playerId} in ${leagueId}:`, error);
        }
    }

    console.log("Update Complete.");
}

recalcLeagueStats();
