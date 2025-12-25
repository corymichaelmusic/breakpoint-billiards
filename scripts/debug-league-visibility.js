const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const OPERATOR_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 1. Admin Client (Service Role) - Should see everything
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log("--- ADMIN VIEW ---");
    const { data: allLeagues } = await adminClient
        .from("leagues")
        .select("id, name, operator_id, type")
        .eq("operator_id", OPERATOR_ID);
    console.table(allLeagues);

    // 2. Check if the ID matches what we think
    console.log("\nTarget Operator ID:", OPERATOR_ID);

    // We can't easily simulate the authenticated client here without a valid JWT for that user.
    // But knowing if the Admin sees it associated with the right ID is step 1.
}

run();
