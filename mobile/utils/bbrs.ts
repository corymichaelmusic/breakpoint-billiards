
// Breakpoint Billiards Rating System (BBRS) v1.0
// Core Logic Implementation

export const BBRS_INITIAL_RATING = 500;

// 1. Core Model (Elo-derived)
// Returns expected win probability for Player A vs Player B
export const calculateExpectedWinProb = (ratingA: number, ratingB: number): number => {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
};

// 2. K-Factor Determination
// Based on experience level (racks played)
export const getBaseKFactor = (racksPlayed: number): number => {
    if (racksPlayed < 100) return 28; // Provisional
    if (racksPlayed < 300) return 20; // Established
    return 14;                        // Stable
};

// 3. Base Delta Calculation
export const calculateBaseDelta = (actualScore: 0 | 1, expectedScore: number, kFactor: number): number => {
    return kFactor * (actualScore - expectedScore);
};

// 4. Opponent Strength Scaling
// Cap scaling between 0.85 (beating much weaker) and 1.15 (beating much stronger)
// Formula: 1 + (Diff / 1000)
export const calculateOpponentScaling = (playerRating: number, opponentRating: number): number => {
    const diff = opponentRating - playerRating;
    const scale = 1 + (diff / 1000);
    return Math.max(0.85, Math.min(1.15, scale));
};

// 5. Match Modifier (Margin of Victory)
// Applied at the END of a set
// M = 1 + min(0.10, (ActualRackDiff - ExpectedRackDiff) / 20)
export const calculateMatchModifier = (actualDiff: number, expectedDiff: number): number => {
    const diffPerformance = actualDiff - expectedDiff;
    const bonus = diffPerformance / 20;
    // Cap bonus at +10% (0.10)
    // Floor? Spec implied positive bonus for exceeding expectation. 
    // If underperforming, bonus is negative, reducing gain?
    // "M is a multiplier". If I win 7-0 but expected 7-5, I gain more.
    // If I win 7-6 but expected 7-0, I gain less.
    return 1 + Math.max(-0.10, Math.min(0.10, bonus)); // Clamp impact to +/- 10%
};

// 6. Event Weighting
export type EventType = 'league' | 'playoffs' | 'tournament';
export const getEventWeight = (type: EventType): number => {
    switch (type) {
        case 'league': return 1.0;
        case 'playoffs': return 1.05;
        case 'tournament': return 1.08;
        default: return 1.0;
    }
};

// 7. Aggregator: Calculate Rating Change for a Set
export const calculateSetRatingChange = (
    playerRating: number,
    opponentRating: number,
    playerScore: number,
    opponentScore: number,
    playerRacksPlayed: number,
    isLeague: boolean = true
): number => {
    // 1. Calculate Expected Win Probability
    const expectedWinProb = calculateExpectedWinProb(playerRating, opponentRating);

    // 2. Determine K-Factor
    const kFactor = getBaseKFactor(playerRacksPlayed);

    // 3. Determine Outcome (1 for win, 0 for loss)
    const actualOutcome = playerScore > opponentScore ? 1 : 0;

    // 4. Calculate Base Delta
    const baseDelta = calculateBaseDelta(actualOutcome, expectedWinProb, kFactor);

    // 5. Apply Opponent Scaling
    const scaling = calculateOpponentScaling(playerRating, opponentRating);
    let delta = baseDelta * scaling;

    // 6. Apply Match Modifier (Margin of Victory)
    // Helper: Estimate expected score difference?
    // Simplified: Use the match modifier function directly with rack diffs
    // Expected Rack Diff can be approximated or ignored for simple MVP, but let's try to use it if simple.
    // Logic: If Prob is 0.6, expected score in race to 7 might be 7-4.
    // For now, let's use the modifier on the base delta itself or just the rack diff.
    // The previously defined function `calculateMatchModifier` uses actual vs expected diff.
    // Let's approximate expected diff: (WinProb - (1-WinProb)) * (Total Racks) ?
    // Total Racks = playerScore + opponentScore
    const totalRacks = playerScore + opponentScore;
    const expectedScoreP1 = totalRacks * expectedWinProb;
    const expectedScoreP2 = totalRacks * (1 - expectedWinProb);
    const expectedDiff = expectedScoreP1 - expectedScoreP2;
    const actualDiff = playerScore - opponentScore;

    const modifier = calculateMatchModifier(actualDiff, expectedDiff);

    // Apply Modifier
    delta = delta * modifier;

    // 7. Apply Event Weight
    const weight = getEventWeight(isLeague ? 'league' : 'tournament');
    delta = delta * weight;

    // Return rounded (or leave raw for caller to round)
    return delta;
};
