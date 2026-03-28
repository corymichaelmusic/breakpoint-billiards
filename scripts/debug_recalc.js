const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const BELINDA = 'user_39XlZlqfHAB3neYHj8wlKnyEj2W';
const CARSON = 'user_39ljU8svOLfZpKZKJUvDZYC0vlz';
const SESSION = '2b08d033-f2cd-47cc-b6d8-78544a5df684';

async function debug() {
    const { data: matches } = await supabase.from('matches').select('*').eq('league_id', SESSION);
    
    let bPlayed = 0, bWon = 0;
    let cPlayed = 0, cWon = 0;

    matches.forEach(m => {
        // 8-Ball
        if (m.status_8ball === 'finalized') {
            if (m.player1_id === BELINDA || m.player2_id === BELINDA) bPlayed++;
            if (m.player1_id === CARSON || m.player2_id === CARSON) cPlayed++;

            if (m.winner_id_8ball === BELINDA) bWon++;
            if (m.winner_id_8ball === CARSON) cWon++;
        }
        // 9-Ball
        if (m.status_9ball === 'finalized') {
            if (m.player1_id === BELINDA || m.player2_id === BELINDA) bPlayed++;
            if (m.player1_id === CARSON || m.player2_id === CARSON) cPlayed++;

            if (m.winner_id_9ball === BELINDA) bWon++;
            if (m.winner_id_9ball === CARSON) cWon++;
        }
    });

    console.log(`Belinda: Played=${bPlayed}, Won=${bWon} -> Record: ${bWon}-${bPlayed-bWon}`);
    console.log(`Carson: Played=${cPlayed}, Won=${cWon} -> Record: ${cWon}-${cPlayed-cWon}`);
}

debug();
