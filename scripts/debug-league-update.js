const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runDebug() {
    console.log("Fetching a league to test update...");
    const { data: leagues, error: fetchError } = await supabase
        .from("leagues")
        .select("*")
        .limit(1);

    if (fetchError) {
        console.error("Error fetching leagues:", fetchError);
        return;
    }

    if (!leagues || leagues.length === 0) {
        console.log("No leagues found to test.");
        return;
    }

    const league = leagues[0];
    console.log("Found league:", league.id, league.name);

    const newName = `${league.name} (Debug ${Date.now()})`;
    console.log(`Attempting to update name to: "${newName}"`);

    const { data, error: updateError } = await supabase
        .from("leagues")
        .update({ name: newName })
        .eq("id", league.id)
        .select();

    if (updateError) {
        console.error("Update FAILED:", updateError);
    } else {
        console.log("Update SUCCESS. New data:", data);
    }
}

runDebug();
