
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectMatchesPoints() {
    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, status_8ball, status_9ball, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2')
        .or('status_8ball.eq.finalized,status_9ball.eq.finalized')
        .limit(5);

    if (error) console.error(error);
    else {
        console.log("Matches Points Data:");
        console.log(JSON.stringify(matches, null, 2));
    }
}
inspectMatchesPoints();
