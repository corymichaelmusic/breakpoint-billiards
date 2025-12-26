const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PLAYER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function debugPlayer() {
    console.log(`\n--- Debugging Player: ${PLAYER_ID} ---`);

    // 1. Check Profile
    const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, email, player_number')
        .eq('id', PLAYER_ID)
        .single();

    if (pError) console.error("Profile Error:", pError.message);
    else console.log("Profile Found:", profile);

    // 2. Check for DUPLICATE profiles by name
    if (profile) {
        const { data: dups } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('full_name', profile.full_name);

        if (dups && dups.length > 1) {
            console.warn("\n!!! DUPLICATE PROFILES FOUND !!!");
            console.table(dups);
        }
    }

    // 3. Check Matches (As Player 1)
    const { data: m1, error: e1 } = await supabase
        .from('matches')
        .select('id, status, player1_id, player2_id')
        .eq('player1_id', PLAYER_ID);

    // 4. Check Matches (As Player 2)
    const { data: m2, error: e2 } = await supabase
        .from('matches')
        .select('id, status, player1_id, player2_id')
        .eq('player2_id', PLAYER_ID);

    const matchCount = (m1?.length || 0) + (m2?.length || 0);
    console.log(`\nMatches Found: ${matchCount}`);
    if (m1?.length) console.log("As Player 1:", m1);
    if (m2?.length) console.log("As Player 2:", m2);

    // 5. Check League Players
    const { data: lp } = await supabase
        .from('league_players')
        .select('*')
        .eq('player_id', PLAYER_ID);
    console.log(`\nLeague Memberships: ${lp?.length}`);
    if (lp?.length) console.log(lp);
}

debugPlayer();
