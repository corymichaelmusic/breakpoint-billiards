
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Must use service role to update profiles if RLS blocks or allows only self-update
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncRatings() {
    console.log("Starting Rating Sync...");

    // 1. Get the latest rating for each player from league_players
    // We assume the 'latest' updated row is the source of truth, or the one with highest ID if updated_at is missing?
    // league_players usually has one row per league.
    // The user implies "current session" rating is the truth.

    // Let's fetch all league_players, order by something?
    // Better: Query unique player_ids and their max rating? No, rating fluctuates.
    // We want the rating from the *most active/recent* session.
    // Let's assume the session with the most recent 'created_at' or matches played.

    const { data: players, error } = await supabase
        .from('league_players')
        .select('player_id, breakpoint_rating, matches_played')
        .not('breakpoint_rating', 'is', null);

    if (error) {
        console.error("Error fetching league_players:", error);
        return;
    }

    console.log(`Found ${players.length} player records. Processing unique...`);

    // Group by player_id and take the one that seems "latest"?
    // Actually, getting "latest" is tricky without a timestamp on league_players update.
    // let's assume the user has only 1 active session or we take the one that is NOT 5.0 if others are?
    // Or just take the last one in the list (if PG returns insertion order? No).

    // Alternate strategy: Fetch matches to find latest match per player, then find the league_player record for that match's league.
    // Too complex.

    // Simple heuristic: Take the highest rating? No.
    // Take the record associated with the current active league?
    // I don't know the active league ID easily here.

    // Let's just update based on *any* record that looks "evolved" (not 5.0) or just do it for all unique players.
    // If a player is in multiple leagues, this might be ambiguous.
    // User said "There is not a separate rating". So all rows should ideally be same?
    // If they are different, we have a problem.

    // Let's check duplicates first.
    const uniqueMap = {};
    const matchesMap = {}; // Track max matches to decide best source

    players.forEach(p => {
        const pid = p.player_id;
        const matches = p.matches_played || 0;
        const rating = p.breakpoint_rating;

        if (!uniqueMap.hasOwnProperty(pid)) {
            uniqueMap[pid] = rating;
            matchesMap[pid] = matches;
        } else {
            // If this record has more matches, it's likely the more accurate "active" rating
            if (matches > matchesMap[pid]) {
                uniqueMap[pid] = rating;
                matchesMap[pid] = matches;
            }
            // If matches are equal (e.g. 0), prefer non-500?
            else if (matches === matchesMap[pid] && rating !== 500 && uniqueMap[pid] === 500) {
                uniqueMap[pid] = rating;
            }
        }
    });

    for (const [playerId, rating] of Object.entries(uniqueMap)) {
        console.log(`Updating ${playerId} to ${rating}...`);
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ breakpoint_rating: rating })
            .eq('id', playerId);

        if (updateError) console.error(`Failed to update ${playerId}:`, updateError);
    }

    console.log("Sync Complete.");
}

syncRatings();
