
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// NEW "Longer" Race Matrices (Hidden from Client)

// 9-Ball Matrix
const matrix9 = [
    // Row 0 (0-344)
    [[3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [3, 6], [3, 8], [2, 8]],
    // Row 1 (345-436)
    [[4, 3], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [4, 7], [3, 8], [3, 8]],
    // Row 2 (437-499)
    [[4, 3], [5, 4], [4, 4], [4, 5], [4, 6], [4, 6], [4, 7], [3, 8], [3, 8]],
    // Row 3 (500-561)
    [[5, 3], [5, 4], [5, 4], [5, 5], [5, 6], [5, 6], [5, 7], [5, 8], [4, 8]],
    // Row 4 (562-624)
    [[5, 3], [6, 4], [6, 4], [6, 5], [6, 6], [5, 6], [5, 7], [5, 8], [4, 8]],
    // Row 5 (625-686)
    [[6, 3], [6, 5], [6, 5], [6, 5], [6, 5], [6, 6], [6, 7], [5, 8], [5, 8]],
    // Row 6 (687-749)
    [[6, 3], [7, 4], [7, 5], [7, 5], [7, 5], [7, 6], [6, 6], [6, 8], [5, 8]],
    // Row 7 (750-875)
    [[8, 3], [8, 3], [7, 4], [8, 5], [8, 5], [8, 6], [8, 6], [7, 7], [7, 8]],
    // Row 8 (876+)
    [[8, 2], [8, 3], [8, 3], [8, 3], [8, 4], [8, 5], [8, 5], [8, 7], [9, 9]]
];

// 8-Ball Matrix
const matrix8 = [
    // Row 0 (0-344)
    [[3, 3], [3, 4], [3, 5], [3, 5], [3, 6], [3, 6], [3, 7], [3, 7], [2, 7]],
    // Row 1 (345-436)
    [[4, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 6], [3, 6], [3, 6], [3, 7]],
    // Row 2 (437-499)
    [[5, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [3, 6], [3, 7]],
    // Row 3 (500-561)
    [[5, 3], [5, 4], [5, 4], [5, 5], [5, 5], [4, 6], [4, 6], [4, 6], [3, 7]],
    // Row 4 (562-624)
    [[6, 3], [5, 4], [5, 4], [5, 5], [5, 5], [5, 6], [4, 6], [4, 6], [4, 7]],
    // Row 5 (625-686)
    [[6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [5, 6], [4, 7]],
    // Row 6 (687-749)
    [[7, 3], [6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [5, 7]],
    // Row 7 (750-875)
    [[7, 3], [6, 3], [6, 3], [6, 4], [6, 4], [6, 5], [6, 5], [6, 6], [6, 7]],
    // Row 8 (876+)
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

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Fetch historical ratings for provided match IDs to ensure accuracy for finalized matches
        const matchIds = matches.map((m: any) => m.id).filter(id => !!id);
        let historicalData: any[] = [];
        if (matchIds.length > 0) {
            const { data } = await supabase
                .from('matches')
                .select('id, player1_rating, player2_rating')
                .in('id', matchIds);
            historicalData = data || [];
        }

        const results: Record<string, any> = {};

        matches.forEach((match: any) => {
            const historical = historicalData.find(h => h.id === match.id);
            
            // Prioritize historical ratings if they exist
            const p1 = historical?.player1_rating || match.p1Rating || 500;
            const p2 = historical?.player2_rating || match.p2Rating || 500;

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
