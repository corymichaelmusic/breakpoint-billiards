const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuery() {
    console.log("Testing nested query...");

    // Try 3: Querying a session directly
    const SESSION_ID = 'b7faf87b-eed9-45ea-b790-2a3572a3298f';
    const { data: data3, error: error3 } = await supabase
        .from("leagues")
        .select(`
            name,
            type,
            parent_league:leagues!leagues_parent_league_id_fkey(name)
        `)
        .eq("id", SESSION_ID)
        .single();

    if (error3) {
        console.error("Error 3:", error3);
    } else {
        console.log("Success 3:", JSON.stringify(data3, null, 2));
    }
}

testQuery();
