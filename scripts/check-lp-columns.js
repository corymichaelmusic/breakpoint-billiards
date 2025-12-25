const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumns() {
    console.log("Checking columns for 'league_players' table...");
    const { data, error } = await supabase
        .from("league_players")
        .select("*")
        .limit(1);

    if (error) {
        console.error("Error fetching league_players:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columns:", Object.keys(data[0]));
    }
}

checkColumns();
