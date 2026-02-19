
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

try {
    const envConfig = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env.local')));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log('Could not load .env.local');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStatuses() {
    console.log('Finding matches to finalize...');

    // Find matches that SHOULD be finalized but aren't
    const { data: matches, error: fetchError } = await supabase
        .from('matches')
        .select('id, status, status_8ball, status_9ball')
        .eq('status_8ball', 'finalized')
        .eq('status_9ball', 'finalized')
        .neq('status', 'finalized'); // Only those not already finalized

    if (fetchError) {
        console.error('Error fetching matches:', fetchError);
        return;
    }

    console.log(`Found ${matches.length} matches to update.`);

    if (matches.length === 0) {
        console.log('No matches need updating.');
        return;
    }

    const matchIds = matches.map(m => m.id);

    // Bulk update
    const { error: updateError } = await supabase
        .from('matches')
        .update({ status: 'finalized' })
        .in('id', matchIds);

    if (updateError) {
        console.error('Error updating statuses:', updateError);
    } else {
        console.log(`Successfully updated ${matches.length} matches to 'finalized'.`);
    }
}

fixStatuses();
