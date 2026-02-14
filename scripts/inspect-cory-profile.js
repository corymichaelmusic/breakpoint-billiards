
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectCory() {
    console.log("Searching for Cory...");

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%Cory%');

    if (error) {
        console.error(error);
        return;
    }

    console.log("Found profiles:", data);
}

inspectCory();
