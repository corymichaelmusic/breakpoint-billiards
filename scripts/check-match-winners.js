
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatchWinners() {
    console.log('Checking finalized matches for winner_id_8ball/9ball...');

    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, points_8ball_p1, points_8ball_p2, race_8ball_p1, race_8ball_p2')
        .eq('status', 'finalized');

    if (error) {
        console.error('Error fetching matches:', error);
        return;
    }

    console.log(`Found ${matches.length} matches.`);

    matches.forEach(m => {
        console.log(`Match ${m.id}:`);
        console.log(`  8-Ball: Status=${m.status_8ball}, Winner=${m.winner_id_8ball}, Points=${m.points_8ball_p1}/${m.race_8ball_p1} vs ${m.points_8ball_p2}/${m.race_8ball_p2}`);
        console.log(`  9-Ball: Status=${m.status_9ball}, Winner=${m.winner_id_9ball}`);
    });
}

checkMatchWinners();
