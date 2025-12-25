
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
    const { data, error } = await supabase
        .from('leagues')
        .select('id, name, type, status');

    if (error) {
        console.error(error);
        return;
    }

    console.log("Found Leagues:", data.length);
    const distinctStatuses = [...new Set(data.map(l => l.status))];
    const distinctTypes = [...new Set(data.map(l => l.type))];

    console.log("Distinct Statuses:", distinctStatuses);
    console.log("Distinct Types:", distinctTypes);

    // Show some examples
    console.log("\nExamples:");
    data.slice(0, 5).forEach(l => console.log(`${l.name} (${l.type}): ${l.status}`));
}

inspect();
