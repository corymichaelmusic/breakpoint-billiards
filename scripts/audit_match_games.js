
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

async function auditGames() {
    const matchId = '38b74738-7708-49c6-b09c-426bdb3cd17d';
    console.log(`Auditing games for match: ${matchId}`);

    const { data: games, error: gamesError } = await supabase
        .from('games')
        .select(`
            id,
            game_number,
            game_type,
            winner_id,
            is_9_on_snap,
            is_break_and_run
        `)
        .eq('match_id', matchId)
        .order('game_number', { ascending: true });

    if (gamesError) {
        console.error('Error fetching games:', gamesError);
        return;
    }

    if (!games || games.length === 0) {
        console.log("No games found.");
        return;
    }

    console.log(`Found ${games.length} games.`);
    let snapCount = 0;

    // We assume we know Jason's ID from previous step: user_39GG3DczoQHmupJEs0RAFXyCpWi
    const jasonId = 'user_39GG3DczoQHmupJEs0RAFXyCpWi';

    games.forEach(g => {
        const isJasonWinner = g.winner_id === jasonId;
        console.log(`Game #${g.game_number} (${g.game_type}): Winner=${isJasonWinner ? 'Jason' : 'Matt'}. 9-Snap=${g.is_9_on_snap}`);

        if (isJasonWinner && g.is_9_on_snap) {
            snapCount++;
        }
    });

    console.log(`Total 9-on-snap for Jason: ${snapCount}`);
    console.log(`Expected: 2`);
}

auditGames();
