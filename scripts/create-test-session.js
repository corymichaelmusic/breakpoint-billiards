
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestSession() {
    console.log('Creating test session...');

    // 1. Find a parent league
    const { data: leagues } = await supabase
        .from("leagues")
        .select("id, name, operator_id")
        .eq("type", "league")
        .eq("status", "active")
        .limit(1);

    if (!leagues || leagues.length === 0) {
        console.error('No active leagues found.');
        return;
    }

    const parent = leagues[0];
    console.log(`Found parent league: ${parent.name} (${parent.id})`);

    // 2. Create a new session
    const { data: newSession, error } = await supabase
        .from("leagues")
        .insert({
            name: "Test Session 2025",
            type: "session",
            status: "active", // Make it active to test late join
            parent_league_id: parent.id,
            operator_id: parent.operator_id,
            creation_fee_status: 'paid'
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating session:', error);
        return;
    }

    console.log(`Created session: ${newSession.name} (${newSession.id})`);
}

createTestSession();
