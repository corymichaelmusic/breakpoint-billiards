const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking for matches with NULL status or non-finalized but with winner...");

    // Fetch matches that look like they should be finalized (have winner) but aren't marked as such
    const { data: matches, error } = await supabase
        .from('matches')
        .select('id, created_at, status, winner_id, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2')
        .not('winner_id', 'is', null) // Has a winner
        .neq('status', 'finalized');  // But NOT finalized (includes NULL?)

    // Note: .neq header might filter nulls depending on Postgrest behavior, strict null checking?
    // Let's try explicit OR query for NULL.

    const { data: nullStatusMatches, error: nullErr } = await supabase
        .from('matches')
        .select('*')
        .not('winner_id', 'is', null)
        .is('status', null);

    if (matches) {
        console.log(`Matches with Winner but status != 'finalized' (count: ${matches.length})`);
        matches.forEach(m => console.log(`ID: ${m.id}, Status: ${m.status}, Winner: ${m.winner_id}`));
    }

    if (nullStatusMatches) {
        console.log(`Matches with Winner but status IS NULL (count: ${nullStatusMatches.length})`);
        nullStatusMatches.forEach(m => console.log(`ID: ${m.id}, Date: ${m.created_at}, Status: NULL, Winner: ${m.winner_id}`));
    }
}

run();
