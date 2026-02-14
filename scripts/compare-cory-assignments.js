require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const coryHinkleyId = 'user_38GKAWlAxWgwMuoirhNpUxHRwWM';
const coryMichaelId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function compareAssignments() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Comparing assignments...');

    const { data: hinkleyOps } = await supabase
        .from('league_operators')
        .select('league_id, leagues(name)')
        .eq('user_id', coryHinkleyId);

    const { data: michaelOps } = await supabase
        .from('league_operators')
        .select('league_id, leagues(name)')
        .eq('user_id', coryMichaelId);

    console.log('\nCory Hinkley Assignments:');
    hinkleyOps.forEach(o => console.log(`- League: ${o.leagues.name} (${o.league_id})`));

    console.log('\nCory Michael Assignments:');
    michaelOps.forEach(o => console.log(`- League: ${o.leagues.name} (${o.league_id})`));
}

compareAssignments();
