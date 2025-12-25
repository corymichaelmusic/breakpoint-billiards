
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testJoin() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const userId = "user_36G4WUMW9oc8aohN8s6FQUX6Xe9";
    const sessionId = "059f7d6b-bbc3-44d6-8228-667e7145ce2c"; // Spring 2026

    console.log("Simulating joinSession...");

    // 1. Check existing
    const { data: existing } = await supabase
        .from("league_players")
        .select("status")
        .eq("league_id", sessionId)
        .eq("player_id", userId)
        .single();

    if (existing) {
        console.log("Already a member:", existing);
        return;
    }

    // 2. Check Operator
    const { data: session } = await supabase.from("leagues").select("parent_league_id").eq("id", sessionId).single();
    const { data: league } = await supabase.from("leagues").select("operator_id").eq("id", session.parent_league_id).single();

    const isOperator = league.operator_id === userId;
    console.log("Is Operator:", isOperator);

    const status = isOperator ? 'active' : 'pending';
    console.log("Determined Status:", status);

    // 3. Insert
    const { data, error } = await supabase
        .from("league_players")
        .insert({
            league_id: sessionId,
            player_id: userId,
            status: status,
            payment_status: 'unpaid'
        })
        .select();

    if (error) {
        console.error("Insert Error:", error);
    } else {
        console.log("Insert Success:", data);
    }
}

testJoin();
