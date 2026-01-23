
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Cannot update profiles.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- BBRS Logic (Ported from mobile/utils/bbrs.ts) ---

const BBRS_INITIAL_RATING = 500;

const calculateExpectedWinProb = (ratingA, ratingB) => {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
};

const getBaseKFactor = (racksPlayed) => {
    if (racksPlayed < 100) return 28;
    if (racksPlayed < 300) return 20;
    return 14;
};

const calculateMatchModifier = (actualDiff, expectedDiff) => {
    const diffPerformance = actualDiff - expectedDiff;
    const bonus = diffPerformance / 20;
    return 1 + Math.max(-0.10, Math.min(0.10, bonus));
};

const calculateOpponentScaling = (playerRating, opponentRating) => {
    const diff = opponentRating - playerRating;
    const scale = 1 + (diff / 1000);
    return Math.max(0.85, Math.min(1.15, scale));
};

const calculateSetRatingChange = (playerRating, opponentRating, playerScore, opponentScore, playerRacksPlayed, isWinner = null) => {
    const expectedWinProb = calculateExpectedWinProb(playerRating, opponentRating);
    const kFactor = getBaseKFactor(playerRacksPlayed);

    let actualOutcome;
    if (isWinner !== null) {
        actualOutcome = isWinner ? 1 : 0;
    } else {
        actualOutcome = playerScore > opponentScore ? 1 : 0;
    }

    // Base Delta
    const baseDelta = kFactor * (actualOutcome - expectedWinProb); // calculateBaseDelta inline

    // Scaling
    const scaling = calculateOpponentScaling(playerRating, opponentRating);
    let delta = baseDelta * scaling;

    // Match Modifier
    const totalRacks = playerScore + opponentScore;
    const expectedScoreP1 = totalRacks * expectedWinProb;
    const expectedScoreP2 = totalRacks * (1 - expectedWinProb);
    const expectedDiff = expectedScoreP1 - expectedScoreP2;
    const actualDiff = playerScore - opponentScore;
    const modifier = calculateMatchModifier(actualDiff, expectedDiff);

    delta = delta * modifier;

    // Event Weight (Assuming League = 1.0 for now as all matches are likely league)
    const weight = 1.0;
    delta = delta * weight;

    return delta;
};

// --- Main Execution ---

async function rebuildRatings() {
    console.log("Starting Rating Recalculation...");

    // 1. Fetch ALL Profiles to initialize state
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id');

    if (pError) { console.error("Error fetching profiles:", pError); return; }

    // State Map: { [playerId]: { rating: 500, racksPlayed: 0 } }
    const playerState = {};
    profiles.forEach(p => {
        playerState[p.id] = { rating: BBRS_INITIAL_RATING, racksPlayed: 0 };
    });

    console.log(`Initialized ${profiles.length} players at ${BBRS_INITIAL_RATING}.`);

    // 2. Fetch ALL Finalized Matches (Chronological)
    // We need both 8-ball and 9-ball matches.
    // Assuming 'matches' table has columns for both and status.
    // Ordering by created_at to simulate history.

    const { data: matches, error: mError } = await supabase
        .from('matches')
        .select('*')
        .order('created_at', { ascending: true }); // Historical order

    if (mError) { console.error("Error fetching matches:", mError); return; }

    console.log(`Found ${matches.length} matches. Replaying history...`);

    let changesCount = 0;

    for (const match of matches) {
        // Process 8-Ball
        if (match.status_8ball === 'finalized') {
            await processGame(match, '8ball', playerState);
            changesCount++;
        }
        // Process 9-Ball
        if (match.status_9ball === 'finalized') {
            await processGame(match, '9ball', playerState);
            changesCount++;
        }
    }

    console.log(`Processed ${changesCount} finalized sets.`);

    // 3. Update Database
    console.log("Updating Profiles in Database...");
    let updateCount = 0;
    for (const [id, state] of Object.entries(playerState)) {
        // Only update if changed (or force all to be safe)
        // Let's force update.
        if (state.rating !== 500 || state.racksPlayed > 0) {
            const { error } = await supabase
                .from('profiles')
                .update({ breakpoint_rating: state.rating })
                .eq('id', id);

            if (error) console.error(`Failed to update ${id}:`, error);
            else updateCount++;
        } else {
            // Reset inactive to 500? Sure.
            const { error } = await supabase
                .from('profiles')
                .update({ breakpoint_rating: 500 })
                .eq('id', id);
        }
    }

    console.log(`Updated ${updateCount} profiles with new ratings.`);
}

async function processGame(match, activeGameType, playerState) {
    const p1Id = match.player1_id;
    const p2Id = match.player2_id;

    // Ensure players exist in state (in case of new players not in initial profile fetch?)
    if (!playerState[p1Id]) playerState[p1Id] = { rating: 500, racksPlayed: 0 };
    if (!playerState[p2Id]) playerState[p2Id] = { rating: 500, racksPlayed: 0 };

    const p1 = playerState[p1Id];
    const p2 = playerState[p2Id];

    const p1Score = activeGameType === '8ball' ? (match.points_8ball_p1 || 0) : (match.points_9ball_p1 || 0);
    const p2Score = activeGameType === '8ball' ? (match.points_8ball_p2 || 0) : (match.points_9ball_p2 || 0);

    // Determine Winner Authoritatively
    let p1Won = false;
    let p2Won = false;

    if (activeGameType === '8ball') {
        if (match.winner_id_8ball) {
            p1Won = match.winner_id_8ball === p1Id;
            p2Won = match.winner_id_8ball === p2Id;
        } else {
            // Fallback for really old data if winner_id missing
            p1Won = p1Score > p2Score;
            p2Won = p2Score > p1Score;
        }
    } else {
        if (match.winner_id_9ball) {
            p1Won = match.winner_id_9ball === p1Id;
            p2Won = match.winner_id_9ball === p2Id;
        } else {
            p1Won = p1Score > p2Score;
            p2Won = p2Score > p1Score;
        }
    }

    // Calculate Deltas
    const p1Delta = calculateSetRatingChange(p1.rating, p2.rating, p1Score, p2Score, p1.racksPlayed, p1Won);
    const p2Delta = calculateSetRatingChange(p2.rating, p1.rating, p2Score, p1Score, p2.racksPlayed, p2Won);

    // Apply Changes
    p1.rating += p1Delta;
    p2.rating += p2Delta;

    // Update Racks Played
    p1.racksPlayed += (p1Score + p2Score);
    p2.racksPlayed += (p1Score + p2Score);

    // console.log(`[Match ${match.id} ${activeGameType}] P1(${p1Id.slice(0,4)}): ${p1Delta.toFixed(1)} -> ${p1.rating.toFixed(1)} | P2(${p2Id.slice(0,4)}): ${p2Delta.toFixed(1)} -> ${p2.rating.toFixed(1)}`);
}

rebuildRatings();
