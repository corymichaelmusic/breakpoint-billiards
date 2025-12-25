const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeagues() {
    const { data: leagues, error } = await supabase
        .from('leagues')
        .select('id, name, status, type, parent_league_id');

    if (error) {
        console.error('Error fetching leagues:', error);
        return;
    }

    console.log('--- Leagues Status ---');
    leagues.forEach(l => {
        console.log(`[${l.type.toUpperCase()}] ${l.name} (ID: ${l.id}) - Status: ${l.status}`);
    });
}

checkLeagues();
