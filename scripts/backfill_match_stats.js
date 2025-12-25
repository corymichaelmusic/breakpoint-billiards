
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// --- BBRS Logic (Copied from bbrs.ts) ---
const BBRS_INITIAL_RATING = 500;
const calculateExpectedWinProb = (ratingA, ratingB) => 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
const getBaseKFactor = (racksPlayed) => {
    if (racksPlayed < 100) return 28;
    if (racksPlayed < 300) return 20;
    return 14;
};
const calculateBaseDelta = (actualScore, expectedScore, kFactor) => kFactor * (actualScore - expectedScore);
const calculateOpponentScaling = (playerRating, opponentRating) => {
    const diff = opponentRating - playerRating;
    const scale = 1 + (diff / 1000);
    return Math.max(0.85, Math.min(1.15, scale));
};
const calculateMatchModifier = (actualDiff, expectedDiff) => {
    const diffPerformance = actualDiff - expectedDiff;
    const bonus = diffPerformance / 20;
    return 1 + Math.max(-0.10, Math.min(0.10, bonus));
};
const getEventWeight = () => 1.0;

const calculateSetRatingChange = (playerRating, opponentRating, playerScore, opponentScore, playerRacksPlayed) => {
    const expectedWinProb = calculateExpectedWinProb(playerRating, opponentRating);
    const kFactor = getBaseKFactor(playerRacksPlayed);
    const actualOutcome = playerScore > opponentScore ? 1 : 0;
    const baseDelta = calculateBaseDelta(actualOutcome, expectedWinProb, kFactor);
    const scaling = calculateOpponentScaling(playerRating, opponentRating);
    let delta = baseDelta * scaling;

    const totalRacks = playerScore + opponentScore;
    const expectedScoreP1 = totalRacks * expectedWinProb;
    const expectedScoreP2 = totalRacks * (1 - expectedWinProb);
    const expectedDiff = expectedScoreP1 - expectedScoreP2;
    const actualDiff = playerScore - opponentScore;
    const modifier = calculateMatchModifier(actualDiff, expectedDiff);
    delta = delta * modifier;
    const weight = getEventWeight();
    delta = delta * weight;
    return delta;
};
// ----------------------------------------

async function backfill() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Get Finalized Matches
        const matchesRes = await client.query(`
            SELECT id, player1_id, player2_id, status_8ball, status_9ball, league_id
            FROM matches 
            WHERE status_8ball = 'finalized' OR status_9ball = 'finalized'
        `);

        for (const match of matchesRes.rows) {
            console.log(`Processing finalized match: ${match.id}`);

            // 2. Fetch Games for this match
            const gamesRes = await client.query(`
                SELECT winner_id, game_type FROM games WHERE match_id = $1
            `, [match.id]);
            const games = gamesRes.rows;

            // Determine active type(s) – could be both?
            // User said "1 and a half matches", so likely one match has both, one has one.
            const types = [];
            if (match.status_8ball === 'finalized') types.push('8ball');
            if (match.status_9ball === 'finalized') types.push('9ball');

            for (const type of types) {
                console.log(`  > Processing Set: ${type}`);

                const typeGames = games.filter(g => g.game_type === type);
                const p1WonRacks = typeGames.filter(g => g.winner_id === match.player1_id).length;
                const p2WonRacks = typeGames.filter(g => g.winner_id === match.player2_id).length;
                const winnerId = p1WonRacks > p2WonRacks ? match.player1_id : match.player2_id;

                console.log(`    Score: ${p1WonRacks}-${p2WonRacks}, Winner: ${winnerId}`);

                // 3. Fetch Player Current Stats (to use ratings) -> Use DEFAULT 500 if null/0
                // We should technically fetch what their rating *was*, but for backfill let's rely on current (or 500 if unset).
                const p1StatsRes = await client.query(`SELECT breakpoint_rating, breakpoint_racks_played FROM league_players WHERE league_id=$1 AND player_id=$2`, [match.league_id, match.player1_id]);
                const p2StatsRes = await client.query(`SELECT breakpoint_rating, breakpoint_racks_played FROM league_players WHERE league_id=$1 AND player_id=$2`, [match.league_id, match.player2_id]);

                let p1Rating = p1StatsRes.rows[0]?.breakpoint_rating || 500;
                let p2Rating = p2StatsRes.rows[0]?.breakpoint_rating || 500;
                let p1RacksPlayed = p1StatsRes.rows[0]?.breakpoint_racks_played || 0;
                let p2RacksPlayed = p2StatsRes.rows[0]?.breakpoint_racks_played || 0;

                // 4. Calculate Deltas
                const p1Delta = calculateSetRatingChange(p1Rating, p2Rating, p1WonRacks, p2WonRacks, p1RacksPlayed);
                const p2Delta = calculateSetRatingChange(p2Rating, p1Rating, p2WonRacks, p1WonRacks, p2RacksPlayed);

                console.log(`    Deltas: P1 ${p1Delta.toFixed(2)}, P2 ${p2Delta.toFixed(2)}`);

                // 5. Update DB (Mimic RPC updates)
                // Note: We are incrementing whatever is there. If we run this twice, we double count!
                // Safety check: Check if matches_played > 0 for this match? 
                // Hard to check per match without a detailed ledger.
                // Assuming currently stats are 0 because columns requested were missing/empty.
                // WE JUST ADDED THE COLUMNS, SO THEY ARE DEFAULT 0. SAFE TO RUN ONCE.

                // P1 Update
                await client.query(`
                    UPDATE league_players
                    SET 
                        breakpoint_rating = breakpoint_rating + $1,
                        breakpoint_racks_won = breakpoint_racks_won + $2,
                        breakpoint_racks_lost = breakpoint_racks_lost + $3,
                        matches_won = matches_won + $4,
                        matches_lost = matches_lost + $5,
                        breakpoint_racks_played = breakpoint_racks_played + $6,
                        matches_played = matches_played + 1
                    WHERE league_id = $7 AND player_id = $8
                `, [
                    p1Delta,
                    p1WonRacks,
                    p2WonRacks,
                    (winnerId === match.player1_id ? 1 : 0),
                    (winnerId !== match.player1_id ? 1 : 0),
                    (p1WonRacks + p2WonRacks),
                    match.league_id,
                    match.player1_id
                ]);

                // P2 Update
                await client.query(`
                    UPDATE league_players
                    SET 
                        breakpoint_rating = breakpoint_rating + $1,
                        breakpoint_racks_won = breakpoint_racks_won + $2,
                        breakpoint_racks_lost = breakpoint_racks_lost + $3,
                        matches_won = matches_won + $4,
                        matches_lost = matches_lost + $5,
                        breakpoint_racks_played = breakpoint_racks_played + $6,
                        matches_played = matches_played + 1
                    WHERE league_id = $7 AND player_id = $8
                `, [
                    p2Delta,
                    p2WonRacks,
                    p1WonRacks,
                    (winnerId === match.player2_id ? 1 : 0),
                    (winnerId !== match.player2_id ? 1 : 0),
                    (p2WonRacks + p1WonRacks),
                    match.league_id,
                    match.player2_id
                ]);

                console.log("    > Stats updated.");
            }
        }

    } catch (e) {
        console.error("Backfill Error:", e);
    } finally {
        await client.end();
    }
}

backfill();
