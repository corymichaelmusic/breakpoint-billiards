
// Map Fargo Rating to Breakpoint Level (1-10)
// Map Fargo Rating to Breakpoint Level (1-10)
// This is the SINGLE SOURCE OF TRUTH for displaying ratings.
export function getBreakpointLevel(rating: number): string {

    if (!rating) return "5.0"; // Default

    // User Logic: Move decimal 2 places to left and display to tenths place (Truncated)
    // e.g. 549.93 -> 5.4
    // e.g. 450.60 -> 4.5
    const val = Math.floor(rating / 10) / 10;
    return val.toFixed(1);
}

export function calculateEloChange(playerRating: number, opponentRating: number, isWin: boolean): number {
    const K_WIN = 30;
    const K_LOSS = 15;
    const K = isWin ? K_WIN : K_LOSS;

    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = isWin ? 1 : 0;

    return Math.round(K * (actualScore - expectedScore));
}

export function calculateRace(rating1: number, rating2: number, gameType: '8ball' | '9ball' = '8ball') {
    const r1 = rating1 || 500;
    const r2 = rating2 || 500;

    const getRangeIndex = (r: number) => {
        if (r <= 275) return 0;
        if (r <= 349) return 1;
        if (r <= 399) return 2;
        if (r <= 449) return 3;
        if (r <= 499) return 4;
        if (r <= 549) return 5;
        if (r <= 599) return 6;
        if (r <= 700) return 7;
        return 8;
    };

    const idx1 = getRangeIndex(r1);
    const idx2 = getRangeIndex(r2);

    let race: number[];

    if (gameType === '9ball') {
        const matrix9 = [
            // Row 0 (200-275)
            [[2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5], [2, 7], [2, 7]],
            // Row 1 (276-349)
            [[3, 2], [3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [2, 7], [2, 7]],
            // Row 2 (350-399)
            [[3, 2], [3, 3], [3, 3], [3, 4], [3, 5], [3, 5], [3, 6], [2, 7], [2, 7]],
            // Row 3 (400-449)
            [[4, 2], [4, 3], [4, 3], [4, 4], [4, 5], [4, 5], [4, 6], [4, 7], [3, 7]],
            // Row 4 (450-499)
            [[4, 2], [4, 3], [4, 3], [4, 4], [5, 5], [4, 5], [4, 6], [4, 7], [3, 7]],
            // Row 5 (500-549)
            [[5, 2], [5, 3], [5, 3], [5, 4], [5, 4], [5, 5], [5, 6], [4, 7], [4, 7]],
            // Row 6 (550-599)
            [[5, 2], [5, 3], [5, 3], [5, 4], [5, 4], [5, 5], [5, 6], [5, 7], [4, 7]],
            // Row 7 (600-700)
            [[6, 2], [6, 2], [6, 3], [6, 4], [6, 4], [6, 5], [6, 6], [6, 7], [6, 7]],
            // Row 8 (701+)
            [[7, 2], [7, 2], [7, 3], [7, 3], [7, 4], [7, 4], [7, 5], [7, 6], [8, 8]]
        ];
        race = matrix9[idx1][idx2];
    } else {
        // 8-Ball Matrix
        const matrix8 = [
            // Row 0 (200-275)
            [[2, 2], [2, 3], [2, 4], [2, 5], [2, 5], [2, 5], [2, 6], [2, 6], [2, 6]],
            // Row 1 (276-349)
            [[3, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 5], [2, 5], [2, 5], [2, 6]],
            // Row 2 (350-399)
            [[4, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [2, 5], [2, 6]],
            // Row 3 (400-449)
            [[4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [3, 5], [3, 5], [3, 5], [2, 6]],
            // Row 4 (450-499)
            [[5, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 5], [3, 5], [3, 5], [3, 6]],
            // Row 5 (500-549)
            [[5, 2], [5, 3], [5, 3], [5, 3], [5, 4], [4, 4], [4, 5], [4, 5], [3, 6]],
            // Row 6 (550-599)
            [[6, 2], [6, 2], [5, 3], [5, 3], [5, 3], [5, 4], [4, 4], [4, 5], [4, 6]],
            // Row 7 (600-700)
            [[6, 2], [6, 2], [5, 2], [5, 3], [5, 3], [5, 4], [5, 4], [5, 5], [5, 6]],
            // Row 8 (701+)
            [[6, 2], [6, 2], [6, 2], [6, 2], [6, 3], [6, 3], [6, 4], [6, 5], [6, 6]]
        ];
        race = matrix8[idx1][idx2];
    }

    return {
        short: { p1: race[0], p2: race[1] },
        long: { p1: race[0], p2: race[1] }
    };
}
