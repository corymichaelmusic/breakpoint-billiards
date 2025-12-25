const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SESSION_ID = '41fe1d0e-7ea0-41df-a6ac-efc82ba07481'; // Fall 2025
const WEEK_NUMBER = 14;

async function resetWeek14() {
    console.log(`Resetting Week ${WEEK_NUMBER} for Session ${SESSION_ID}...`);

    const { error } = await supabase
        .from("matches")
        .update({
            status: 'scheduled',
            winner_id: null,
            current_points_p1: 0,
            current_points_p2: 0
        })
        .eq("league_id", SESSION_ID)
        .eq("week_number", WEEK_NUMBER);

    if (error) {
        console.error("Error resetting matches:", error);
    } else {
        console.log("Matches reset successfully.");
    }
}

resetWeek14();
