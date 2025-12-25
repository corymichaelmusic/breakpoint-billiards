
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSpecificMatch() {
    const userId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';
    console.log(`Searching matches for user ${userId}...`);

    const { data: matches } = await supabase
        .from('matches')
        .select(`
            *,
            player1:player1_id(full_name),
            player2:player2_id(full_name)
        `)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq('status', 'finalized');

    console.log(`Found ${matches.length} matches.`);

    matches.forEach(m => {
        console.log(`Match ${m.id}:`);
        console.log(`  P1: ${m.player1.full_name}, P2: ${m.player2.full_name}`);
        console.log(`  8-Ball: Status=${m.status_8ball}, Winner=${m.winner_id_8ball}, Points=${m.points_8ball_p1} vs ${m.points_8ball_p2}`);
        console.log(`  9-Ball: Status=${m.status_9ball}, Winner=${m.winner_id_9ball}, Points=${m.points_9ball_p1} vs ${m.points_9ball_p2}`);
    });
}

checkSpecificMatch();
