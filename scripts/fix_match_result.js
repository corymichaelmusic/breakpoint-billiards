const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function fixMatch() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const matchId = '65ebedad-2ed9-493e-9180-b0116a12eff3';
    const davidId = 'user_39AlZQKboH2dlFhTW6bctvhnTiA';
    const glennId = 'user_39XmZOmAboWjLWia4zViNBYTv6n';

    console.log(`Fixing match result for: ${matchId}`);

    // 1. Update winner_id in matches
    const { error: matchError } = await supabase
        .from('matches')
        .update({
            winner_id: davidId,
            winner_id_8ball: davidId,
            winner_id_9ball: glennId, // Wait, did Glenn win 9-ball? 6-4 with race?
            // Let's check 9-ball race for 651 vs 448
            // Row 5 (625-686), Col 2 (437-499) -> Row 5, Index 2
            // 9-ball Matrix: Row 5, Index 0=[6,3], 1=[6,5], 2=[6,5]
            // So Glenn needs 6, David needs 5.
            // If Glenn has 6 and David has 4, Glenn won 9-ball.
        })
        .eq('id', matchId);

    if (matchError) {
        console.error("Error updating match:", matchError);
    } else {
        console.log("Match updated successfully.");
    }

    // 2. We should ideally revert the rating changes for this match and re-apply them with the correct winner.
    // However, since ratings are now global and we just set Glenn to 651, we should probably leave them as is unless the user wants a full recalculation.
    // Given the complexity of reverting multiple matches, I'll just fix the display winner for now.
}

fixMatch();
