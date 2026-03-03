require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Searching for Spring 2026 session...");
    const { data: leagues, error } = await supabase
        .from('leagues')
        .select('*')
        .ilike('name', '%spring 2026%');

    if (error) {
        console.error("Error fetching leagues:", error);
        return;
    }

    if (!leagues || leagues.length === 0) {
        console.log("No league found matching 'Spring 2026'");
        return;
    }

    for (const league of leagues) {
        console.log(`Found session: ${league.name} (ID: ${league.id}), Status: ${league.status}`);

        if (league.status === 'completed') {
            console.log("Reverting status to 'active'...");
            const { error: updateError } = await supabase
                .from('leagues')
                .update({ status: 'active' })
                .eq('id', league.id);

            if (updateError) {
                console.error("Error updating status:", updateError);
            } else {
                console.log("Successfully reverted session to active.");
            }
        } else {
            console.log("Session is not 'completed', no action needed.");
        }
    }
}

main();
