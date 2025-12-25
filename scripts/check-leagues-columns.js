
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkColumns() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .rpc('get_columns', { table_name: 'leagues' }); // This RPC might not exist, let's try a direct query if possible or just select * limit 1

    // Alternative: Select one row and print keys
    const { data: rows } = await supabase.from('leagues').select('*').limit(1);

    if (rows && rows.length > 0) {
        console.log('Columns:', Object.keys(rows[0]));
    } else {
        console.log('No rows found, cannot infer columns easily without introspection.');
    }
}

checkColumns();
