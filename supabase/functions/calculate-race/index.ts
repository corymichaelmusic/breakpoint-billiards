
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// NEW "Longer" Race Matrices (Hidden from Client)

// 9-Ball Matrix
const matrix9 = [
    // Row 0 (0-275)
    [[3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [3, 6], [3, 8], [2, 8]],
    // Row 1 (276-349)
    [[4, 3], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [4, 7], [3, 8], [3, 8]],
    // Row 2 (350-399)
    [[4, 3], [5, 4], [4, 4], [4, 5], [4, 6], [4, 6], [4, 7], [3, 8], [3, 8]],
    // Row 3 (400-449)
    [[5, 3], [5, 4], [5, 4], [5, 5], [5, 6], [5, 6], [5, 7], [5, 8], [4, 8]],
    // Row 4 (450-499)
    [[5, 3], [6, 4], [6, 4], [6, 5], [6, 6], [5, 6], [5, 7], [5, 8], [4, 8]],
    // Row 5 (500-549)
    [[6, 3], [6, 5], [6, 5], [6, 5], [6, 5], [6, 6], [6, 7], [5, 8], [5, 8]],
    // Row 6 (550-599)
    [[6, 3], [7, 4], [7, 5], [7, 5], [7, 5], [7, 6], [6, 6], [6, 8], [5, 8]],
    // Row 7 (600-700)
    [[8, 3], [8, 3], [7, 4], [8, 5], [8, 5], [8, 6], [8, 6], [7, 7], [7, 8]],
    // Row 8 (701+)
    [[8, 2], [8, 3], [8, 3], [8, 3], [8, 4], [8, 5], [8, 5], [8, 7], [9, 9]]
];

// 8-Ball Matrix
const matrix8 = [
    // Row 0 (0-275)
    [[3, 3], [3, 4], [3, 5], [3, 5], [3, 6], [3, 6], [3, 7], [3, 7], [2, 7]],
    // Row 1 (276-349)
    [[4, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 6], [3, 6], [3, 6], [3, 7]],
    // Row 2 (350-399)
    [[5, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [3, 6], [3, 7]],
    // Row 3 (400-449)
    [[5, 3], [5, 4], [5, 4], [5, 5], [5, 5], [4, 6], [4, 6], [4, 6], [3, 7]],
    // Row 4 (450-499)
    [[6, 3], [5, 4], [5, 4], [5, 5], [5, 5], [5, 6], [4, 6], [4, 6], [4, 7]],
    // Row 5 (500-549)
    [[6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [5, 6], [4, 7]],
    // Row 6 (550-599)
    [[7, 3], [6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [5, 7]],
    // Row 7 (600-700)
    [[7, 3], [6, 3], [6, 3], [6, 4], [6, 4], [6, 5], [6, 5], [6, 6], [6, 7]],
    // Row 8 (701+)
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

function calculateSingleRace(rating1: number, rating2: number, gameType: '8ball' | '9ball') {
    const r1 = rating1 || 500;
    const r2 = rating2 || 500;
    const idx1 = getRangeIndex(r1);
    const idx2 = getRangeIndex(r2);

    const racePair = gameType === '9ball' ? matrix9[idx1][idx2] : matrix8[idx1][idx2];
    return { p1: racePair[0], p2: racePair[1] };
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            },
        })
    }

    try {
        const { matches } = await req.json();

        if (!matches || !Array.isArray(matches)) {
            throw new Error("Invalid body. Expected 'matches' array.");
        }

        const results: Record<string, any> = {};

        matches.forEach((match: any) => {
            const p1 = match.p1Rating || 500;
            const p2 = match.p2Rating || 500;

            // Calculate both if type not specified, or specific if needed
            // The app needs both for the match card (short.p1/p2)

            const race8 = calculateSingleRace(p1, p2, '8ball');
            const race9 = calculateSingleRace(p1, p2, '9ball');

            results[match.id] = {
                race8,
                race9
            };
        });

        return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
    }
})
