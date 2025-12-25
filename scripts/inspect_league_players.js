
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data, error } = await supabase
        .rpc('get_columns', { table_name: 'league_players' }) // Try RPC first if exists, otherwise assume failure
        .catch(() => ({ error: 'RPC not found' }));

    // Standard way: Query information_schema? Not possible via JS Client directly unless permissions allow.
    // Instead: Select one row and look at keys.
    const { data: rows } = await supabase.from('league_players').select('*').limit(1);
    console.log("Columns inferred from data:", rows && rows.length > 0 ? Object.keys(rows[0]) : "No rows found");
}

checkColumns();
