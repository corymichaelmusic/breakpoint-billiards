
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpRequests() {
    const { data, error } = await supabase.from('reschedule_requests').select('*').limit(20).order('created_at', { ascending: false });
    if (error) console.error(error);
    else console.log("Requests:", data);
}
dumpRequests();
