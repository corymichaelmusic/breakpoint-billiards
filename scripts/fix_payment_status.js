
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixPaymentStatus() {
    console.log(`Fixing payment status for: Bishop and Moschella`);

    // 1. Find User IDs
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .or('full_name.ilike.%Bishop%,full_name.ilike.%Moschella%');

    if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return;
    }

    const playerIds = profiles.map(p => p.id);
    console.log(`Found ${playerIds.length} profiles to update.`);

    // 2. Update to 'paid_online' for 'Spring 2026' session
    // First find the session ID for "Spring 2026" (assuming that's the one from the logs)
    // Actually, let's just update ANY 'session' membership where they are 'unpaid'
    // Or stick to the league IDs found in previous step?
    // Previous step showed they are in "Spring 2026" (session) and "Money Mondays" (league).
    // The fee is likely for the SESSION "Spring 2026".

    // Fetch session id for "Spring 2026"
    const { data: session } = await supabase.from('leagues').select('id').eq('name', 'Spring 2026').eq('type', 'session').single();

    if (!session) {
        console.log("Could not find Spring 2026 session. Searching generic.");
    }

    const sessionId = session?.id;
    console.log(`Target Session ID: ${sessionId}`);

    if (sessionId) {
        const { error } = await supabase
            .from('league_players')
            .update({ payment_status: 'paid_online' })
            .in('player_id', playerIds)
            .eq('league_id', sessionId)
            .eq('payment_status', 'unpaid'); // Only update if currently unpaid

        if (error) {
            console.error("Update failed:", error);
        } else {
            console.log("Successfully updated payment status to 'paid_online' for Spring 2026.");
        }
    }
}

fixPaymentStatus();
