// Manual Matrix Verification
// I'll copy the logic briefly or use a mock. 
// Actually I can just replicate the matrix logic here to be sure, or try to run TS via ts-node if installed.
// Simpler: Access the matrix logic from the file content I viewed in Step 714.

function getRangeIndex(r) {
    if (r <= 275) return 0;
    if (r <= 349) return 1;
    if (r <= 399) return 2;
    if (r <= 449) return 3;
    if (r <= 499) return 4;
    if (r <= 549) return 5;
    if (r <= 599) return 6;
    if (r <= 700) return 7;
    return 8;
}

// 9-Ball Matrix from Step 714
const matrix9 = [
    // Row 0 (200-275)
    [[2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5], [2, 7], [2, 7]],
    // Row 1 (276-349) - Savannah (309) is here (Index 1)
    [[3, 2], [3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [2, 7], [2, 7]],
    // Row 2 (350-399)
    [[3, 2], [3, 3], [3, 3], [3, 4], [3, 5], [3, 5], [3, 6], [2, 7], [2, 7]],
    // Row 3 (400-449)
    [[4, 2], [4, 3], [4, 3], [4, 4], [4, 5], [4, 5], [4, 6], [4, 7], [3, 7]],
    // Row 4 (450-499) - Quinton (495) is here? Wait.
    // 450-499 is idx 4.
    // Quinton is 495. So Index 4.
    [[4, 2], [4, 3], [4, 3], [4, 4], [5, 5], [4, 5], [4, 6], [4, 7], [3, 7]],
    // ...
];

const r1 = 309; // Savannah
const r2 = 495; // Quinton

const idx1 = getRangeIndex(r1); // 1
const idx2 = getRangeIndex(r2); // 4

// Lookup: matrix[idx1][idx2]
// Row 1, Col 4.
// Row 1: [[3, 2], [3, 3], [3, 4], [3, 4], [3, 5] ...
// Indices: 0       1       2       3       4
// Element at [4] is [3, 5].

console.log(`Rating 1: ${r1} (Idx ${idx1})`);
console.log(`Rating 2: ${r2} (Idx ${idx2})`);
console.log(`Target: ${matrix9[idx1][idx2]}`);
console.log("Expected: Savannah needs 3, Quinton needs 5.");
