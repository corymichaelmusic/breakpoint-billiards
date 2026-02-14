require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const coryMichaelId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function checkCoryMichaelActivity() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log(`Checking activity for Cory Michael (${coryMichaelId})...`);

    const { count: lpCount } = await supabase
        .from('league_players')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', coryMichaelId);

    const { count: m1Count } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('player1_id', coryMichaelId);

    const { count: m2Count } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('player2_id', coryMichaelId);

    const { count: opCount } = await supabase
        .from('league_operators')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', coryMichaelId);

    console.log(`League Memberships: ${lpCount}`);
    console.log(`Matches (P1): ${m1Count}`);
    console.log(`Matches (P2): ${m2Count}`);
    console.log(`League Operator Assignments: ${opCount}`);
}

checkCoryMichaelActivity();
