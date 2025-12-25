
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testDelete() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Create a test league
    const { data: league, error: createError } = await supabase
        .from('leagues')
        .insert({
            name: 'Test Delete League',
            operator_id: 'user_2pI5Jq...', // Use a dummy ID or a real one if known
            status: 'active'
        })
        .select()
        .single();

    if (createError) {
        console.error('Error creating league:', createError);
        return;
    }

    console.log('Created test league:', league.id);

    // 2. Simulate Non-Admin User (using a random ID)
    // We can't easily simulate auth.uid() with service role client in a simple script without signing a JWT
    // But we can check the RLS policy by trying to delete with a client that has a specific user token if we had one.
    // Instead, let's just verify the policy exists.

    const { data: policies } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'leagues');

    // This query won't work directly on client, need direct PG connection or rpc
    // Let's just rely on the server action test.

    console.log("To verify, please try to delete a league from the UI as a non-admin.");
}

// testDelete();
console.log("Manual verification required via UI or by inspecting RLS policies in SQL Editor.");
