const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectTable(tableName) {
    console.log(`\n--- Columns in ${tableName} ---`);
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }

    if (data && data.length > 0) {
        console.log(Object.keys(data[0]).join(', '));
    } else {
        console.log("Table empty, checking types not possible via select. Attempting insertion dry-run or error message inspection.");
        // Fallback: This simple method requires at least one row.
        // If empty, I might not see columns.
    }
}

(async () => {
    await inspectTable('sessions');
    await inspectTable('league_players');
    await inspectTable('session_players'); // In case this exists
})();
