
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Service Key present:', !!supabaseServiceKey);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTable() {
    // Check if it's a table or view
    const { data, error } = await supabase
        .rpc('get_table_info', { table_name: 'league_players' });
    // Wait, I don't have a generic rpc. I'll use a raw query if possible, but supabase-js doesn't support raw SQL easily without rpc.

    // Alternative: Try to select from information_schema using PostgREST? 
    // PostgREST doesn't expose information_schema by default.

    // Let's try to just select one row and print it, to confirm we can READ.
    const { data: rows, error: readError } = await supabase
        .from('league_players')
        .select('*')
        .limit(1);

    if (readError) {
        console.error('Read Error:', readError);
    } else {
        console.log('Read success. Row count:', rows.length);
    }
}

checkTable();
