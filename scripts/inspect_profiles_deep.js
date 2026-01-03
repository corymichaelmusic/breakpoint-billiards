
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('--- Inspecting PROFILES Table ---');

    // 1. Check Column Defaults
    const { data: columns, error: colError } = await supabase
        .rpc('get_columns', { table_name: 'profiles' })
        .catch(async () => {
            // Fallback to direct select if RPC not available, but schemas are hard to query via client unless exposed.
            // We'll try to insert a dummy row and see what happens? No, better to query information_schema if enabled.
            return await supabase.from('information_schema.columns')
                .select('column_name, column_default, is_nullable')
                .eq('table_name', 'profiles')
                .eq('table_schema', 'public');
        });

    if (columns) {
        console.log('Columns:', JSON.stringify(columns, null, 2));
    } else {
        // If we can't query info schema directly (access denied), we'll try raw SQL via 'exec_sql' if user set that up (unlikely).
        // Let's rely on the user running SQL if this fails.
        console.log('Could not query information_schema via client (expected if RLS on system tables).');
    }

    // 2. Check Triggers logic via SQL injection simulation? 
    // No, let's just log the row we have.

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }) // created_at might not exist
        .order('id', { ascending: false })
        .limit(1);

    console.log('Latest Profile:', profile);
}

inspect();
