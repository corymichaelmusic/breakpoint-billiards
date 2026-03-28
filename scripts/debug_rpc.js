const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debugRPC() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const testCases = [
        { r1: 516, r2: 448, type: '8ball' },
        { r1: 500, r2: 500, type: '8ball' },
        { r1: 517, r2: 449, type: '8ball' }
    ];

    for (const tc of testCases) {
        console.log(`\nTesting: R1=${tc.r1}, R2=${tc.r2}, Type=${tc.type}`);
        const { data, error } = await supabase.rpc('get_race_target', {
            p_rating1: tc.r1,
            p_rating2: tc.r2,
            p_game_type: tc.type
        });

        if (error) {
            console.error("RPC Error:", error);
        } else {
            console.log("Result:", data);
        }
    }
}

debugRPC();
