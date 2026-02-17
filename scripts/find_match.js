
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findMatch() {
    const { data, error } = await supabase
        .from('matches')
        .select(`
            id, 
            week_number,
            player1:player1_id(id, full_name),
            player2:player2_id(id, full_name)
        `);

    if (error) {
        console.error(error);
        return;
    }

    const matches = data.filter(m =>
        (m.player1.full_name.includes('Glenn') && m.player2.full_name.includes('Belinda')) ||
        (m.player1.full_name.includes('Belinda') && m.player2.full_name.includes('Glenn'))
    );

    if (matches.length > 0) {
        matches.forEach(match => {
            console.log(`MATCH_ID=${match.id}`);
            console.log(`WEEK=${match.week_number}`);
            console.log(`PLAYER1=${match.player1.full_name} (${match.player1.id})`);
            console.log(`PLAYER2=${match.player2.full_name} (${match.player2.id})`);
            console.log('---');
        });
    } else {
        console.log("Match not found");
    }
}

findMatch();
