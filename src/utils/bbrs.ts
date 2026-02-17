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


        race8: { p1: race8[0], p2: race8[1] },
        race9: { p1: race9[0], p2: race9[1] }
    };
}
