const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function clearMatches() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Clearing all matches...');
    const { error } = await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
        console.error('Error clearing matches:', error);
    } else {
        console.log('Matches cleared successfully.');
    }
}

clearMatches();
