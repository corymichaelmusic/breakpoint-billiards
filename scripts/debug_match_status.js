const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debugMatches() {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!sbUrl || !sbKey) {
        console.error("Missing Supabase Env Vars");
        return;
    }

    const supabase = createClient(sbUrl, sbKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log("Fetching profiles...");
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email');

    if (profileError) {
        console.error("Error fetching profiles:", profileError);
        return;
    }

    const playerMap = {};
    profiles.forEach(p => {
        playerMap[p.id] = p.full_name || p.email;
    });

    console.log("Fetching matches...");
    // Fetch league timezone as well
    const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('*, leagues(timezone)')
        .order('created_at', { ascending: false });

    if (matchError) {
        console.error("Error fetching matches:", matchError);
        return;
    }

    const targetMatches = matches.filter(m => {
        const p1Name = playerMap[m.player1_id] || 'Unknown';
        const p2Name = playerMap[m.player2_id] || 'Unknown';

        // Simple case insensitive check
        const p1 = p1Name.toLowerCase();
        const p2 = p2Name.toLowerCase();

        // Check if ANY of the target names are in the match (to see context)
        const targetNames = ['Belinda', 'Michael', 'Casey', 'Matt'];
        return targetNames.some(n => p1.includes(n.toLowerCase())) && targetNames.some(n => p2.includes(n.toLowerCase()));
    });

    console.log(`Found ${targetMatches.length} matching matches.`);

    for (const m of targetMatches) {
        const p1Name = playerMap[m.player1_id];
        const p2Name = playerMap[m.player2_id];
        console.log(`\nMatch ID: ${m.id}`);
        // Handle case where leagues might be an array or object
        const leagueTz = Array.isArray(m.leagues) ? m.leagues[0]?.timezone : m.leagues?.timezone;
        console.log(`League ID: ${m.league_id} | Timezone: ${leagueTz} | Week: ${m.week_number}`);
        console.log(`${p1Name} vs ${p2Name}`);
        console.log(`Status: ${m.status}`);
        console.log(`Scheduled Date: ${m.scheduled_date}`);
        console.log(`Scheduled Time: ${m.scheduled_time}`);
        console.log(`Wrapper Timezone: ${process.env.TZ}`); // Just curious but node doesn't usually set this from .env unless passed
    }
}

debugMatches();
