const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OLD_PLAYER_ID = 'dummy_user_2a3a1ca3';
const NEW_PLAYER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function swapPlayer() {
    console.log(`Swapping ${OLD_PLAYER_ID} with ${NEW_PLAYER_ID}...`);

    // 1. Update league_players
    const { error: lpError } = await supabase
        .from('league_players')
        .update({ player_id: NEW_PLAYER_ID })
        .eq('player_id', OLD_PLAYER_ID);

    if (lpError) console.error("Error updating league_players:", lpError);
    else console.log("Updated league_players.");

    // 2. Update matches (player1)
    const { error: m1Error } = await supabase
        .from('matches')
        .update({ player1_id: NEW_PLAYER_ID })
        .eq('player1_id', OLD_PLAYER_ID);

    if (m1Error) console.error("Error updating matches (player1):", m1Error);
    else console.log("Updated matches (player1).");

    // 3. Update matches (player2)
    const { error: m2Error } = await supabase
        .from('matches')
        .update({ player2_id: NEW_PLAYER_ID })
        .eq('player2_id', OLD_PLAYER_ID);

    if (m2Error) console.error("Error updating matches (player2):", m2Error);
    else console.log("Updated matches (player2).");

    // 4. Update matches (winner)
    const { error: wError } = await supabase
        .from('matches')
        .update({ winner_id: NEW_PLAYER_ID })
        .eq('winner_id', OLD_PLAYER_ID);

    if (wError) console.error("Error updating matches (winner):", wError);
    else console.log("Updated matches (winner).");

    console.log("Swap complete.");
}

swapPlayer();
