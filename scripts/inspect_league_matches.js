
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLeagueMatches() {
    const leagueId = '9c914ef5-8a23-4f24-b163-444c8a05def6';
    console.log(`Inspecting Matches for League: ${leagueId}`);

    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, status, status_8ball, status_9ball, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2')
        .eq('league_id', leagueId);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${matches.length} matches.`);
    matches.forEach(m => console.log(m));
}

inspectLeagueMatches();
