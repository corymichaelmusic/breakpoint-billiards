
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

try {
    const envConfig = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env.local')));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log('Could not load .env.local');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSubStatuses() {
    console.log('Checking status_8ball and status_9ball for Week 1...');

    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, status, status_8ball, status_9ball, week_number, player1_id, player2_id')
        .eq('week_number', 1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${matches.length} matches for Week 1.`);

    const finalizedCount = matches.filter(m =>
        m.status_8ball === 'finalized' && m.status_9ball === 'finalized'
    ).length;

    console.log(`Matches with BOTH statuses finalized: ${finalizedCount}`);

    if (matches.length > 0) {
        console.log('Sample Match:', matches[0]);
    }
}

checkSubStatuses();
