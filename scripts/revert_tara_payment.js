
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function revertTaraPayment() {
    console.log(`Reverting payment status for: Tara Moschella`);

    // 1. Find User ID
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', 'taramos1772@gmail.com')
        .single();

    if (profileError || !profile) {
        console.error('Error fetching profile:', profileError);
        return;
    }

    const playerId = profile.id;
    console.log(`Found ID: ${playerId}`);

    // 2. Revert to 'unpaid' for 'Spring 2026' session

    // Find Session ID
    const { data: session } = await supabase.from('leagues').select('id').eq('name', 'Spring 2026').eq('type', 'session').single();
    const sessionId = session?.id;

    if (sessionId) {
        const { error } = await supabase
            .from('league_players')
            .update({ payment_status: 'unpaid' })
            .eq('player_id', playerId)
            .eq('league_id', sessionId)
            .eq('payment_status', 'paid_online'); // Only if it was paid_online

        if (error) {
            console.error("Revert failed:", error);
        } else {
            console.log("Successfully reverted payment status to 'unpaid' for Spring 2026.");
        }
    }
}

revertTaraPayment();
