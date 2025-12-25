const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function resetLeagues() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Deleting matches...');
    const { error: matchesError } = await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (matchesError) console.error('Error deleting matches:', matchesError);

    console.log('Deleting league players...');
    const { error: lpError } = await supabase.from('league_players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (lpError) console.error('Error deleting league players:', lpError);

    console.log('Deleting leagues...');
    const { error: leaguesError } = await supabase.from('leagues').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (leaguesError) console.error('Error deleting leagues:', leaguesError);

    console.log('Reset complete.');
}

resetLeagues();
