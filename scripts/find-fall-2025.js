const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findSession() {
    const { data, error } = await supabase
        .from('leagues')
        .select('id, name, status')
        .eq('name', 'Fall 2025')
        .single();

    if (error) {
        console.error("Error finding session:", error);
    } else {
        console.log("Found Session:", data);
    }
}

findSession();
