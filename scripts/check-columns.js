const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
    console.log("Checking columns for 'leagues' table...");

    // We can't easily query information_schema via supabase-js directly without a function or raw SQL if not exposed.
    // But we can try to select * limit 1 and see the keys.

    const { data, error } = await supabase
        .from("leagues")
        .select("*")
        .limit(1);

    if (error) {
        console.error("Error fetching leagues:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columns found in returned data:", Object.keys(data[0]));
    } else {
        console.log("No data found in leagues table, cannot infer columns from result.");
        // Try inserting a dummy record to see if it fails? No, that's risky.
    }
}

checkColumns();
