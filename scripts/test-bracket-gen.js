
// Mock Bracket Generator Logic for Testing
// Can be run with `node scripts/test-bracket-gen.js`

function generateBracketStructure(participantCount) {
    let size = 2;
    while (size < participantCount) size *= 2;
    console.log(`Participants: ${participantCount}, Bracket Size: ${size}`);

    const matches = [];
    const totalRounds = Math.log2(size);

    // --- WINNERS BRACKET ---
    // Round 1: size/2 matches
    // Round 2: size/4 matches...
    // Round N: 1 match (Finals of Winners)

    let currentRoundMatches = size / 2;
    let roundNum = 1;

    // Track "previous round match IDs" to link them?
    // Or just generating them with codes is enough for now. The "Advancement Logic" will handle the mapping (e.g. W1 -> W9).

    // Standard mapping:
    // R1 Match 1 & 2 -> R2 Match 1
    // R1 Match 3 & 4 -> R2 Match 2

    while (currentRoundMatches >= 1) {
        for (let i = 1; i <= currentRoundMatches; i++) {
            matches.push({
                code: `WR${roundNum}-${i}`,
                round: roundNum,
                side: 'winners',
                name: `Winners Round ${roundNum} Match ${i}`,
                nextUp: `WR${roundNum + 1}-${Math.ceil(i / 2)}`, // Winner goes here
                toLoser: getLoserDrop(roundNum, i, size) // Loser goes here
            });
        }
        currentRoundMatches /= 2;
        roundNum++;
    }

    // --- LOSERS BRACKET ---
    // Losers bracket structure depends on the round.
    // L-R1: Drops from W-R1 (size/4 matches? No, size/2 losers drop... so size/4 matches). 
    // Wait. R1 has 8 matches (16 players). 8 Losers.
    // L-R1 needs to accommodate 4 matches? 
    // Usually: 
    // W-R1 (8 matches) -> 8 Losers.
    // L-R1: 4 matches. (Wait, 8 losers need 4 matches). Yes.
    // L-R2: 4 matches. (4 Winners from L-R1 + 4 Losers from W-R2).
    // L-R3: 2 matches.
    // L-R4: 2 matches.
    // L-R5: 1 match.
    // L-R6: 1 match. (Loser Finals)
    // Formula: Losers bracket has 2 * (N-1) rounds usually? Or close to it.

    // Let's iterate rounds.
    // Losers Round 1 matches count = Winners Round 1 matches / 2.

    // Logic is simpler:
    // Round 1 (L): Takes 2 losers from W-R1. (Matches = W-R1_Count / 2).
    // Round 2 (L): Takes winner of L-R1 + Loser from W-R2. (Matches = same as L-R1).
    // Round 3 (L): Takes 2 winners from L-R2. (Matches = L-R2 / 2).
    // Round 4 (L): Takes winner of L-R3 + Loser from W-R3. (Matches = same as L-R3).

    // It alternates: Halve the count -> Keep the count -> Halve -> Keep.

    let losersMatchesCount = (size / 2) / 2; // Start with half of W-R1 count
    let losersRoundNum = 1;
    // We need to generate up to where we meet the winners final loser.

    // How many losers rounds? 
    // For 16 players: W-Rounds = 4. L-Rounds = 6? 
    // WR1 (8m) -> LR1 (4m)
    // WR2 (4m) -> LR2 (4m) [Joins LR1 winners]
    //             LR3 (2m)
    // WR3 (2m) -> LR4 (2m) [Joins LR3 winners]
    //             LR5 (1m)
    // WR4 (1m) -> LR6 (1m) [Joins LR5 winners]
    // Final: WR4 winner vs LR6 winner.

    // Loop until count < 1
    // Actually we iterate based on "feeding" rounds.

    while (losersMatchesCount >= 1) {
        // ODD Losers Rounds (1, 3, 5...): Pure internal advancement from previous L-Round.
        // EVEN Losers Rounds (2, 4, 6...): Fed by Winners Bracket drops.

        // Wait, Round 1 IS fed by W-R1. 
        // LR1 (4 matches) takes 8 losers from WR1.

        // Round 2 (4 matches) takes 4 winners from LR1 + 4 losers from WR2.

        // Round 3 (2 matches) takes 4 winners from LR2.

        // Round 4 (2 matches) takes 2 winners from LR3 + 2 losers from WR3.

        // So:
        // Round 1: Feed from WR1.
        // Round 2: Feed from WR2 + LR1.
        // Round 3: Feed from LR2.
        // Round 4: Feed from WR3 + LR3.

        // Pattern:
        // Round N (where N is odd): Pure structure? No, Round 1 is Odd and fed by WR1.
        // Let's refine:
        // Rounds that receive Drop-downs: 1, 2, 4, 6... (Round 1 receives from WR1. Round 2 receives from WR2. Round 4 from WR3).
        // Rounds that are just consolidation: 3, 5, 7...

        // Let's generate them.

        // L-Round 1
        for (let i = 1; i <= losersMatchesCount; i++) {
            matches.push({ code: `LR${losersRoundNum}-${i}`, round: losersRoundNum, side: 'losers' });
        }

        // Next round (Round 2) has SAME count.
        losersRoundNum++;
        for (let i = 1; i <= losersMatchesCount; i++) {
            matches.push({ code: `LR${losersRoundNum}-${i}`, round: losersRoundNum, side: 'losers', note: 'Fed by Drop' });
        }

        // Next round (Round 3) has HALF count.
        losersMatchesCount /= 2;
        losersRoundNum++;

        if (losersMatchesCount < 1) break;
    }

    // Add "Finals" (Winner of WR-Final vs Winner of LR-Final)
    // matches.push({ code: 'F1', side: 'finals' });

    console.log("Total Matches Generated:", matches.length);
    console.log(matches.map(m => m.code).join(", "));
}

function getLoserDrop(wRound, wMatchNum, size) {
    // Logic to calculate where the loser goes.
    // WR1 losers -> LR1.
    // WR2 losers -> LR2.
    // WR3 losers -> LR4.
    // WR4 losers -> LR6.

    // Mapping matches to matches is the hard part (The "Cross-over" to avoid rematches).
    return "TBD";
}

generateBracketStructure(8); // Test with 8
generateBracketStructure(16); // Test with 16
