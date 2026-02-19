
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Try to load .env.local
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
// Or service role key if needed but inspection might work with anon if RLS allows or if we valid credentials
// better to use service role if available for schema inspection usually, but let's try anon or see if we can find service key env var
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Role Key in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
    // We can't directly query information_schema via JS client usually, unless we use RPC or raw query if enabled.
    // But we can try to select * limit 1 and see the keys.

    const { data, error } = await supabase
        .from('matches')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching matches:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns in matches table:', Object.keys(data[0]));
    } else {
        console.log('No matches found to infer schema.');
    }

    // Also check if we can run a raw query potentially?
    // supabase.rpc usually used for functions.
}

checkSchema();
