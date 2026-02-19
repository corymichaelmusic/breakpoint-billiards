
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
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Role Key.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
    // Fetch a few finalized matches to see what data they have
    const { data, error } = await supabase
        .from('matches')
        .select('id, status, race_8ball_p1, race_8ball_p2, race_9ball_p1, race_9ball_p2, started_at')
        .eq('status', 'finalized')
        .limit(5);

    if (error) {
        console.error('Error fetching matches:', error);
        return;
    }

    console.log('Finalized Matches Data Sample:');
    console.log(JSON.stringify(data, null, 2));
}

checkData();
