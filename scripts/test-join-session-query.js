const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testJoinSessionQuery() {
    console.log("Testing Join Session Query...");

    // Attempting the query from JoinSessionPage
    const { data: leagues, error } = await supabase
        .from("leagues")
        .select(`
            id,
            name,
            sessions:leagues(
                id,
                name,
                status
            )
        `)
        .eq("type", "league")
        .eq("status", "active");

    if (error) {
        console.error("Query Error:", error);
    } else {
        console.log("Query Success:", JSON.stringify(leagues, null, 2));
    }
}

testJoinSessionQuery();
