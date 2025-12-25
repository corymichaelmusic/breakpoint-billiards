const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Fetching finalized matches...");

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'finalized')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${matches.length} recent finalized matches. Inspecting sample:`);

    matches.forEach(m => {
        console.log(`\nMatch ID: ${m.id} | Date: ${m.scheduled_date}`);
        console.log(`  P1: ${m.player1_id} | P2: ${m.player2_id}`);
        console.log(`  Status: ${m.status} | SubmittedAt: ${m.submitted_at}`);
        console.log(`  8-Ball: Status=${m.status_8ball}, Pts=${m.points_8ball_p1}-${m.points_8ball_p2}, Winner=${m.winner_id_8ball}`);
        console.log(`  9-Ball: Status=${m.status_9ball}, Pts=${m.points_9ball_p1}-${m.points_9ball_p2}, Winner=${m.winner_id_9ball}`);
        console.log(`  Overall Winner: ${m.winner_id}`);
    });

    // Check for potentially missing stats
    const { count: missingSubmit } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'finalized')
        .is('submitted_at', null);

    console.log(`\nMatches finalized but submitted_at is NULL: ${missingSubmit}`);

    const { count: missing8BallStatus } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .gt('points_8ball_p1', 0) // Has points
        .neq('status_8ball', 'finalized'); // But not finalized

    console.log(`Matches with 8-ball points but status_8ball NOT finalized: ${missing8BallStatus}`);
}

run();
