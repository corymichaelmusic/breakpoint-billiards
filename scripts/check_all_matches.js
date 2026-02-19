
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

async function checkAll() {
    console.log('Checking ANY matches...');
    const { count, error } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error counting matches:', error);
    } else {
        console.log(`Total Matches in DB: ${count}`);
    }

    const { data } = await supabase.from('matches').select('id, status').limit(5);
    console.log('Sample IDs:', data);
}

checkAll();
