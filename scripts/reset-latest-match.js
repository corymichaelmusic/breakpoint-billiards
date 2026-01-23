const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase URL or Service Role Key in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetLatestMatch() {
    // Hardcoded reset for identified match
    const matchId = 'ae2b0468-1da5-4fd3-ad2c-2e498b19b91d';
    console.log(`Resetting Match ID: ${matchId} (Faithe vs Cory)`);

    // Delete games
    const { error: gamesError } = await supabase
        .from('games')
        .delete()
        .eq('match_id', matchId);

    if (gamesError) console.error("Error deleting games:", gamesError);
    else console.log("Games deleted.");

    // Reset Match
    const { error: matchError } = await supabase
        .from('matches')
        .update({
            status: 'scheduled',
            status_8ball: 'scheduled',
            status_9ball: 'scheduled',
            winner_id: null,
            winner_id_8ball: null,
            winner_id_9ball: null,
            points_8ball_p1: 0,
            points_8ball_p2: 0,
            points_9ball_p1: 0,
            points_9ball_p2: 0,
            submitted_at: null,
            // notes: null, // Removed as column missing
            // verification_status: 'pending' // Keeping this if it exists, otherwise might fail too. Let's try.
        })
        .eq('id', matchId);

    if (matchError) console.error("Error resetting match:", matchError);
    else console.log("Match reset successfully.");
}

resetLatestMatch();
