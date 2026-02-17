
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStats() {
    console.log("Verifying Stats for Glenn and Belinda Vinson...");
    const { data, error } = await supabase
        .from('league_players')
        .select('player_id, matches_played, matches_won')
        .eq('league_id', '2b08d033-f2cd-47cc-b6d8-78544a5df684')
        .in('player_id', ['user_39XmZOmAboWjLWia4zViNBYTv6n', 'user_39XlZlqfHAB3neYHj8wlKnyEj2W']);

    if (error) {
        console.error(error);
        return;
    }

    data.forEach(p => {
        const name = p.player_id === 'user_39XmZOmAboWjLWia4zViNBYTv6n' ? 'Glenn' : 'Belinda';
        console.log(`${name}: Played ${p.matches_played}, Won ${p.matches_won}`);
    });
}

verifyStats();
