require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const userIds = [
    'user_38gSzTJhxDpEAsKibijWzCxZRE1',
    'user_38VH2mzSnhuvUtEHfoMukz0ZmdP',
    'user_38V8MV9EpEnIbKAeb6mOCjtrUHS',
    'user_38V7Vlzg7uLY2ssFDXn1VE8he51'
];

async function checkActivity() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Checking for user activity...');

    for (const uid of userIds) {
        const { count: lpCount } = await supabase
            .from('league_players')
            .select('*', { count: 'exact', head: true })
            .eq('player_id', uid);

        const { count: m1Count } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('player1_id', uid);

        const { count: m2Count } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('player2_id', uid);

        console.log(`User ${uid}: League Memberships: ${lpCount}, Matches (P1): ${m1Count}, Matches (P2): ${m2Count}`);
    }
}

checkActivity();
