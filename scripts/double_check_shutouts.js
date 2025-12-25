
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShutouts() {
    const { data: players, error } = await supabase
        .from('league_players')
        .select(`
            player_id,
            shutouts
        `)
        .gt('matches_played', 0);

    if (error) console.error(error);
    else console.log("DB Values:", JSON.stringify(players, null, 2));
}
checkShutouts();
