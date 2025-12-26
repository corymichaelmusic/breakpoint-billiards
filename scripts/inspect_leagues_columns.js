const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    const sql = fs.readFileSync('supabase/add_bounty_shutout.sql', 'utf8');
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }); // Assuming exec_sql exists, else direct query if possible?
    // User doesn't have exec_sql usually.
    // Fallback: This is usually done via Migration Tool or Dashboard.
    // But since I have Service Role, I can maybe try raw SQL if I had a tool.
    // I'll try to use a standard Postgres connection if available, or just notify user.
    // Actually, I can use the existing `scripts/setup-db.js` pattern or similar?
    // Or just run it via the `pg` library if installed. `pg` is in package.json.

    // Changing approach to use `pg` directly since Supabase JS client doesn't support raw SQL on "public" unless exposed via RPC.
})();

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
    console.log("Table empty or no data found to infer columns.");
}
}

(async () => {
    await inspectTable('leagues');
})();
