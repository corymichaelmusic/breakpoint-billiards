const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkScoreColumns() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
        .from('matches')
        .select('score_9ball_p1, score_8ball_p1')
        .limit(1);

    if (error) {
        console.error('Error selecting score columns:', error);
    } else {
        console.log('Score columns exist. Data sample:', data);
    }
}

checkScoreColumns();
