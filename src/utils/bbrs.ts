// 9-Ball Matrix
const matrix9 = [
    // Row 0 (0-275) - [2, 2] ? No, Image says 3/3 for 0-344. 
    // Wait. My code in Step 43 had [[3, 3]...] for Row 0. But logic says 0-344 return 0. 
    // Let's use EXACTLY what was in Step 43 which I verified matches the logic generally, but I should be careful about the "Row 0 (0-275)" comment in my Step 43 code vs the logic `if (r <= 344) return 0`.
    // The code in Step 43:
    // `const matrix9 = [ [[3, 3], ...`
    // `function getRangeIndex(r) { if (r <= 344) return 0; ...`
    // This matches the image Row 0 range "0-344".
    // So I will copy the arrays and the helper function.

    [[3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [3, 6], [3, 8], [2, 8]],
    [[4, 3], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [4, 7], [3, 8], [3, 8]],
    [[4, 3], [5, 4], [4, 4], [4, 5], [4, 6], [4, 6], [4, 7], [3, 8], [3, 8]],
    [[5, 3], [5, 4], [5, 4], [5, 5], [5, 6], [5, 6], [5, 7], [5, 8], [4, 8]],
    [[5, 3], [6, 4], [6, 4], [6, 5], [6, 6], [5, 6], [5, 7], [5, 8], [4, 8]],
    [[6, 3], [6, 5], [6, 5], [6, 5], [6, 5], [6, 6], [6, 7], [5, 8], [5, 8]],
    [[6, 3], [7, 4], [7, 5], [7, 5], [7, 5], [7, 6], [6, 6], [6, 8], [5, 8]],
    [[8, 3], [8, 3], [7, 4], [8, 5], [8, 5], [8, 6], [8, 6], [7, 7], [7, 8]],
    [[8, 2], [8, 3], [8, 3], [8, 3], [8, 4], [8, 5], [8, 5], [8, 7], [9, 9]]
];

// 8-Ball Matrix
const matrix8 = [
    [[3, 3], [3, 4], [3, 5], [3, 5], [3, 6], [3, 6], [3, 7], [3, 7], [2, 7]],
    [[4, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 6], [3, 6], [3, 6], [3, 7]],
    [[5, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [3, 6], [3, 7]],
    [[5, 3], [5, 4], [5, 4], [5, 5], [5, 5], [4, 6], [4, 6], [4, 6], [3, 7]],
    [[6, 3], [5, 4], [5, 4], [5, 5], [5, 5], [5, 6], [4, 6], [4, 6], [4, 7]],
    [[6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [5, 6], [4, 7]],
    [[7, 3], [6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [5, 7]],
    [[7, 3], [6, 3], [6, 3], [6, 4], [6, 4], [6, 5], [6, 5], [6, 6], [6, 7]],
    [[7, 2], [7, 3], [7, 3], [7, 3], [7, 4], [7, 4], [7, 5], [7, 6], [7, 7]]
];

function getRangeIndex(r: number) {
    if (r <= 344) return 0;
    if (r <= 436) return 1;
    if (r <= 499) return 2;
    if (r <= 561) return 3;
    if (r <= 624) return 4;
    if (r <= 686) return 5;
    if (r <= 749) return 6;
    if (r <= 875) return 7;
    return 8;
}

export function calculateRace(rating1: number, rating2: number) {
    const r1 = rating1 || 500;
    const r2 = rating2 || 500;
    const idx1 = getRangeIndex(r1);
    const idx2 = getRangeIndex(r2);

    const race8 = matrix8[idx1][idx2];
    const race9 = matrix9[idx1][idx2];

    return {
        // Map to expected structure { short: {p1, p2}, long: {p1, p2} }
        // BUT wait, short/long was old logic.
        // The App expects 'short' and 'long'.
        // "short" usually corresponds to 8-ball or 9-ball?
        // MatchStartScreen.tsx allows selecting "Short Race" or "Long Race".
        // And then "8ball" or "9ball".
        // Wait, MatchStartScreen has `selectedRace` ('short'/'long') AND `selectedGame` ('8ball'/'9ball').
        // `races` prop has `short` and `long`.
        // If I replace logic, do I map 8ball to 'short' and 9ball to 'long'?
        // No. The user provided "8-Ball Race Matrix" and "9-Ball Race Matrix".
        // This implies the race depends on the GAME chosen, not just "short/long".
        // MatchStartScreen logic:
        // `startMatch(..., selectedRace, selectedGame)`
        // If I select "Short Race" in UI, what does that mean if I'm playing 8-Ball?
        // The UI separates Race Selection (Short/Long) from Game Type.
        // This seems conflated.

        // If the User provided separate matrices for 8-ball and 9-ball, that implies:
        // If I play 8-Ball, I use 8-Ball Matrix.
        // If I play 9-Ball, I use 9-Ball Matrix.

        // Is "Short" 8-Ball and "Long" 9-Ball?
        // Let's look at `startMatch` in `match-start-actions.ts`:
        // `if (gameType === '8ball') { updates.race_8ball_p1 = selectedRace.p1 ... }`
        // `const selectedRace = races[raceType];` (raceType is 'short' or 'long').

        // It seems the current app structure assumes "Short" and "Long" are two OPTIONS available, regardless of game?
        // OR does Short=8Ball and Long=9Ball?
        // Code: `const selectedRace = races[raceType];`
        // If I pick "Short", I get `races.short`.

        // If I only have ONE matrix for 8-ball and ONE matrix for 9-ball...
        // Then `races.short` should probably be the 8-ball race? And `races.long` the 9-ball race?
        // BUT what if I play 8-Ball "Long"? The matrix doesn't seem to support that.

        // User request: "Here are the race matrices that we need to be implimenting."
        // I should probably map:
        // Short -> 8-Ball Matrix
        // Long -> 9-Ball Matrix
        // (Since 8-ball races are typically shorter/different than 9-ball?)

        // Let's look at the arrays.
        // 8-Ball Row 4: 5/5
        // 9-Ball Row 4: 6/6
        // 9-ball races appear slightly longer.

        // I will map:
        // short: 8-Ball Matrix result
        // long: 9-Ball Matrix result

        race8: { p1: race8[0], p2: race8[1] },
        race9: { p1: race9[0], p2: race9[1] }
    };
}
