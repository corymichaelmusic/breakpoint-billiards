
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// BIS Short Race Matrices
const matrix9 = [
    [[2, 2], [2, 3], [2, 3], [2, 3], [2, 4], [2, 4], [2, 4], [2, 5], [2, 6]],
    [[3, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 4], [3, 5], [3, 6], [3, 6]],
    [[3, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 4], [3, 5], [3, 6], [3, 6]],
    [[4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 4], [4, 5], [4, 6], [3, 6]],
    [[4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 4], [4, 5], [4, 6], [3, 6]],
    [[4, 2], [4, 3], [4, 4], [4, 4], [4, 4], [4, 4], [4, 5], [4, 6], [4, 6]],
    [[5, 2], [5, 3], [5, 3], [5, 4], [5, 4], [5, 4], [4, 4], [4, 6], [4, 6]],
    [[6, 2], [6, 3], [5, 3], [6, 4], [6, 4], [6, 4], [6, 4], [5, 5], [5, 6]],
    [[6, 2], [6, 3], [6, 3], [6, 3], [6, 3], [6, 4], [6, 4], [6, 5], [6, 6]],
];

const matrix8 = [
    [[2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 4], [2, 5], [2, 5], [2, 5]],
    [[3, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 4], [2, 5], [2, 5]],
    [[3, 2], [3, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 4], [3, 5], [3, 5]],
    [[4, 2], [3, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 4], [3, 5], [3, 5]],
    [[4, 2], [4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 5], [4, 5], [3, 5]],
    [[4, 2], [4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 5]],
    [[5, 2], [4, 2], [4, 3], [4, 3], [5, 4], [5, 4], [4, 4], [4, 5], [4, 5]],
    [[5, 2], [5, 2], [5, 3], [5, 3], [5, 4], [5, 4], [5, 4], [5, 5], [4, 5]],
    [[5, 2], [5, 2], [5, 3], [5, 3], [5, 3], [5, 4], [5, 4], [5, 4], [5, 5]],
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
