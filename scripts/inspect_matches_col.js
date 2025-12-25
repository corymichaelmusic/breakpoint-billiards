
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatches() {
    const { data, error } = await supabase.from('matches').select('*').limit(1);
    if (data && data.length > 0) {
        console.log("Matches Columns:", Object.keys(data[0]));
        console.log("Sample Data (unlock info):", {
            id: data[0].id,
            is_manually_unlocked: data[0].is_manually_unlocked,
            unlock_requested: data[0].unlock_requested
        });
    } else {
        console.error("Error or no data:", error);
    }
}
checkMatches();
