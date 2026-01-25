
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMatchWinners() {
    console.log("Fetching matches for 'Test Group 2'...");

    // First find the league/session ID for "Test Group 2"
    const { data: leagues, error: leagueError } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('name', 'Test Group 2');

    if (leagueError) {
        console.error('Error fetching league:', leagueError);
        return;
    }

    if (!leagues || leagues.length === 0) {
        console.log("No league found named 'Test Group 2'");
        return;
    }

    const leagueId = leagues[0].id;
    console.log(`Found League ID: ${leagueId}`);

    // Fetch matches
    const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select(`
      id,
      created_at,
      status, 
      status_8ball,
      status_9ball,
      points_8ball_p1,
      points_8ball_p2,
      points_9ball_p1,
      points_9ball_p2,
      winner_id,
      player1_id,
      player2_id,
      p1:player1_id(full_name),
      p2:player2_id(full_name)
    `)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: true });

    if (matchError) {
        console.error('Error fetching matches:', matchError);
        return;
    }

    console.log(`Found ${matches.length} matches.`);

    matches.forEach((m, idx) => {
        const p1Name = m.p1?.full_name || 'Unknown';
        const p2Name = m.p2?.full_name || 'Unknown';

        const p1Total = (m.points_8ball_p1 || 0) + (m.points_9ball_p1 || 0);
        const p2Total = (m.points_8ball_p2 || 0) + (m.points_9ball_p2 || 0);

        console.log(`\nMatch #${idx + 1}: ${p1Name} vs ${p2Name}`);
        console.log(`Status: ${m.status} (8B: ${m.status_8ball}, 9B: ${m.status_9ball})`);
        console.log(`Scores: P1: ${p1Total} (${m.points_8ball_p1}/${m.points_9ball_p1}) vs P2: ${p2Total} (${m.points_8ball_p2}/${m.points_9ball_p2})`);
        console.log(`Winner ID in DB: ${m.winner_id}`);

        if (m.winner_id === m.player1_id) console.log(`-> Winner matches Player 1 (${p1Name})`);
        else if (m.winner_id === m.player2_id) console.log(`-> Winner matches Player 2 (${p2Name})`);
        else console.log(`-> Winner ID DOES NOT MATCH either player! (Or is null)`);
    });
}

checkMatchWinners();
