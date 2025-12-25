
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testFinancials() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Update Settings
    console.log("Updating settings...");
    await supabase.from('system_settings').upsert({ key: 'default_session_fee', value: '30' });
    await supabase.from('system_settings').upsert({ key: 'default_creation_fee', value: '150' });

    // 2. Create Session (Simulate)
    // We need an operator ID and a parent league ID.
    // Let's fetch the first available league.
    const { data: league } = await supabase.from('leagues').select('id, operator_id').eq('type', 'league').limit(1).single();

    if (!league) {
        console.error("No league found to test session creation.");
        return;
    }

    console.log(`Creating session for league ${league.id} (Operator: ${league.operator_id})...`);

    // Fetch settings again to simulate server action logic
    const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["default_session_fee", "default_creation_fee"]);

    const sessionFee = Number(settings.find(s => s.key === "default_session_fee").value);
    const creationFee = Number(settings.find(s => s.key === "default_creation_fee").value);

    const { data: session, error } = await supabase
        .from("leagues")
        .insert({
            name: "Financial Test Session",
            operator_id: league.operator_id,
            parent_league_id: league.id,
            type: 'session',
            status: 'setup',
            session_fee: sessionFee,
            creation_fee: creationFee,
            creation_fee_status: 'unpaid'
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating session:", error);
    } else {
        console.log("Session created:", session);
        console.log(`Verified Fees: Session Fee = ${session.session_fee}, Creation Fee = ${session.creation_fee}`);

        if (session.session_fee === 30 && session.creation_fee === 150) {
            console.log("SUCCESS: Fees match updated settings.");
        } else {
            console.error("FAILURE: Fees do not match.");
        }

        // Cleanup
        await supabase.from('leagues').delete().eq('id', session.id);
        console.log("Test session deleted.");
    }

    // Reset Settings
    console.log("Resetting settings...");
    await supabase.from('system_settings').upsert({ key: 'default_session_fee', value: '25' });
    await supabase.from('system_settings').upsert({ key: 'default_creation_fee', value: '100' });
}

testFinancials();
