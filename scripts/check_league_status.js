
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatus() {
    console.log("Checking League Statuses...");
    const { data: leagues, error } = await supabase
        .from('leagues')
        .select('id, name, type, status, start_date')
        .order('created_at', { ascending: false });

    if (error) console.error(error);
    else console.table(leagues);
}

checkStatus();
