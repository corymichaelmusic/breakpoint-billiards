
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRatings() {
    // Check league_players for breakpoint_rating
    const { data: lpData, error: lpError } = await supabase
        .from('league_players')
        .select('player_id, breakpoint_rating')
        .eq('league_id', '5180cb9d-9cf3-40e1-abc2-9694e502c462')
        .in('player_id', ['24b025d5-865f-4099-aabc-0761e3d09e3e', 'f6327318-7b92-426b-a81d-e0655a6d71b3']);

    // Check profiles for fargo_rating
    const { data: pData, error: pError } = await supabase
        .from('profiles')
        .select('id, fargo_rating, full_name')
        .in('id', ['24b025d5-865f-4099-aabc-0761e3d09e3e', 'f6327318-7b92-426b-a81d-e0655a6d71b3']);

    console.log("League Players:", lpData);
    console.log("Profiles:", pData);
}

checkRatings();
