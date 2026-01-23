const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStatus() {
    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, status, status_8ball, status_9ball');

    if (error) { console.error(error); return; }

    let finalizedLegacy = 0;
    let finalized8 = 0;
    let finalized9 = 0;

    matches.forEach(m => {
        if (m.status === 'finalized') finalizedLegacy++;
        if (m.status_8ball === 'finalized') finalized8++;
        if (m.status_9ball === 'finalized') finalized9++;
    });

    console.log(`Total Matches: ${matches.length}`);
    console.log(`Legacy Finalized: ${finalizedLegacy}`);
    console.log(`8-Ball Finalized: ${finalized8}`);
    console.log(`9-Ball Finalized: ${finalized9}`);
}

checkStatus();
