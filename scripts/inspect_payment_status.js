
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPaymentStatus() {
    console.log(`Checking payment status for: Bishop and Moschella`);

    // 1. Find User IDs
    // Using a single OR clause for both names
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', 'taramos1772@gmail.com');

    if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('No profiles found matching names.');
        return;
    }

    console.log('Found profiles:', profiles.map(p => `${p.full_name} (${p.id})`));

    const playerIds = profiles.map(p => p.id);

    // 2. Check League Players Status
    const { data: memberships, error: memberError } = await supabase
        .from('league_players')
        .select(`
      player_id, 
      payment_status, 
      status,
      league_id,
      leagues (name, type, status)
    `)
        .in('player_id', playerIds);

    if (memberError) {
        console.error('Error fetching memberships:', memberError);
        return;
    }

    console.log('\n--- Membership records ---');
    memberships.forEach(m => {
        const profile = profiles.find(p => p.id === m.player_id);
        console.log(`Player: ${profile.full_name}`);
        console.log(`  League: ${m.leagues?.name} (${m.leagues?.type})`);
        console.log(`  Payment Status: ${m.payment_status}`);
        console.log(`  Membership Status: ${m.status}`);
        console.log('---');
    });
}

checkPaymentStatus();
