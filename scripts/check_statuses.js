
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

async function checkStatuses() {
    console.log('Checking unique statuses...');
    // This is a bit hacky without .distinct(), so let's just fetch all statuses and count in JS
    const { data, error } = await supabase.from('matches').select('status');

    if (error) {
        console.error('Error fetching statuses:', error);
        return;
    }

    const counts = {};
    data.forEach(m => {
        counts[m.status] = (counts[m.status] || 0) + 1;
    });

    console.log('Match Status Counts:', counts);

    // If we have finalized matches, let's look at one
    const finalized = data.filter(m => m.status === 'finalized' || m.status === 'completed');
    if (finalized.length > 0) {
        const { data: sample } = await supabase
            .from('matches')
            .select('id, race_8ball_p1, player1_rating')
            .eq('status', 'finalized')
            .limit(1);
        console.log('Sample Finalized Match Data:', sample);
    }
}

checkStatuses();
