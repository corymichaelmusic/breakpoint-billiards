
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    // Select one row
    const { data, error } = await supabase.from('league_players').select('*').limit(1);

    if (error) {
        console.error("Error fetching row:", error);
    } else if (data && data.length > 0) {
        console.log("Columns found:", Object.keys(data[0]));
    } else {
        console.log("No rows found, cannot infer columns from data.");
        // Fallback: try to insert a dummy row with a known column to verify connection, 
        // but we assume at least one player exists since user has data.
    }
}

checkColumns();
