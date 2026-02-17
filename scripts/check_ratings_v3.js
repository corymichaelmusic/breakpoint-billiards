
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
        .eq('league_id', '2b08d033-f2cd-47cc-b6d8-78544a5df684')
        .in('player_id', ['user_39GS3UMc77JWeMi3rQ5huSNixqt', 'user_39ljU8svOLfZpKZKJUvDZYC0vlz']);

    // Check profiles for fargo_rating
    const { data: pData, error: pError } = await supabase
        .from('profiles')
        .select('id, fargo_rating, full_name')
        .in('id', ['user_39GS3UMc77JWeMi3rQ5huSNixqt', 'user_39ljU8svOLfZpKZKJUvDZYC0vlz']);

    console.log("League Players:", lpData);
    console.log("Profiles:", pData);
}

checkRatings();
