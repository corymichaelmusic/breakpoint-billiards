const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkTable() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Checking chat_read_status table structure...');

    const { data, error } = await supabase.rpc('get_table_info', { table_name: 'chat_read_status' });

    if (error) {
        // Fallback to direct query if RPC doesn't exist
        console.log('RPC get_table_info failed, trying information_schema...');
        const { data: cols, error: colError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_name', 'chat_read_status')
            .eq('table_schema', 'public');

        if (colError) {
            console.error('Error fetching columns:', colError);
            return;
        }
        console.log('Columns for chat_read_status:', cols);
    } else {
        console.log('Table Info:', data);
    }
}

checkTable();
