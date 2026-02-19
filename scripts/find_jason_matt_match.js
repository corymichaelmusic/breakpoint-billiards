
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

async function findMatch() {
    console.log("Finding match between Jason Lakotich and Matt Good...");

    // Find players
    const { data: players, error: playersError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('full_name', ['Jason Lakotich', 'Matt Good']);

    if (playersError) {
        console.error('Error fetching players:', playersError);
        return;
    }

    if (!players || players.length !== 2) {
        console.log('Could not find both players. Found:', players);
        return;
    }

    const p1 = players.find(p => p.full_name === 'Jason Lakotich');
    const p2 = players.find(p => p.full_name === 'Matt Good');

    console.log(`Jason ID: ${p1.id}`);
    console.log(`Matt ID: ${p2.id}`);

    // Find matches
    const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select(`
            id, 
            created_at, 
            player1_id, 
            player2_id, 
            p1_nine_on_snap, 
            p2_nine_on_snap,
            points_9ball_p1,
            points_9ball_p2
        `)
        .or(`player1_id.eq.${p1.id},player2_id.eq.${p1.id}`)
        .or(`player1_id.eq.${p2.id},player2_id.eq.${p2.id}`)
    // We need matches where BOTH are present. The above ORs are not quite right for "AND" logic in Supabase efficiently across columns without raw SQL or better filtering.
    // Actually, let's just fetch matches for Jason and filter in JS for Matt.


    if (matchError) {
        // Try a different approach if the above query is too complex/invalid
        console.error('Error fetching matches with OR query, trying simpler approach...');
    }

    // Simpler approach: Fetch matches where Jason is player1 OR player2
    const { data: matchesJason, error: errorJason } = await supabase
        .from('matches')
        .select(`
            id, 
            created_at, 
            player1_id, 
            player2_id, 
            p1_nine_on_snap, 
            p2_nine_on_snap,
            points_9ball_p1,
            points_9ball_p2
        `)
        .or(`player1_id.eq.${p1.id},player2_id.eq.${p1.id}`);

    if (errorJason) {
        console.error('Error fetching matches for Jason:', errorJason);
        return;
    }

    // Filter for matches against Matt
    const relevantMatches = matchesJason.filter(m =>
        (m.player1_id === p2.id) || (m.player2_id === p2.id)
    );

    console.log(`Found ${relevantMatches.length} matches between Jason and Matt.`);

    relevantMatches.forEach(m => {
        console.log(`Match ID: ${m.id}`);
        console.log(`Date: ${m.created_at}`);
        const isJasonP1 = m.player1_id === p1.id;
        console.log(`Jason is ${isJasonP1 ? 'Player 1' : 'Player 2'}`);
        console.log(`Stats for Jason: 9BS = ${isJasonP1 ? m.p1_nine_on_snap : m.p2_nine_on_snap}`);
        console.log(`Stats for Matt: 9BS = ${isJasonP1 ? m.p2_nine_on_snap : m.p1_nine_on_snap}`);
        console.log('---');
    });
}

findMatch();
