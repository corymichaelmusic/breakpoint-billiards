const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkFinalized() {
    console.log('Checking for finalized matches without submission date...');
    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'finalized')
        .is('submitted_at', null);

    if (error) { console.error(error); return; }
    
    console.log(`Found ${matches.length} finalized but unsubmitted matches.`);
    
    if (matches.length > 0) {
        console.log('Submitting them...');
        const updates = matches.map(m => 
             supabase.from('matches').update({ submitted_at: new Date().toISOString() }).eq('id', m.id)
        );
        await Promise.all(updates);
        console.log('Done.');
    }
}
checkFinalized();
