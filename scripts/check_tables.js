
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

async function listTables() {
    console.log("Listing tables (via rpc or inference if possible)...");

    // Supabase JS client doesn't have a direct 'listTables' method for public use usually,
    // but we can try to query a common table or just guess. 
    // Actually, we can use the `pg_catalog` if we had SQL access.
    // Since we only have JS, let's try to select from 'profiles' and see if it works.

    const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .limit(1);

    if (!gamesError) {
        console.log("Table 'games' exists.");
        console.log("Sample game:", games[0]);
    } else {
        console.log("Table 'games' error:", gamesError.message);

        // Try match_games
        const { data: matchGames, error: matchGamesError } = await supabase
            .from('match_games')
            .select('*')
            .limit(1);

        if (!matchGamesError) {
            console.log("Table 'match_games' exists.");
            console.log("Sample match_game:", matchGames[0]);
        } else {
            console.log("Table 'match_games' error:", matchGamesError.message);
        }
    }
}

listTables();
