
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRowSizes() {
    console.log("Fetching sample Match...");
    const { data: matches, error: mErr } = await supabase.from('matches').select('*').limit(1);
    if (matches && matches.length > 0) {
        console.log("Match Row Length (JSON):", JSON.stringify(matches[0]).length);
        console.log("Match Keys:", Object.keys(matches[0]));
    }

    console.log("Fetching sample Game...");
    const { data: games, error: gErr } = await supabase.from('games').select('*').limit(1);
    if (games && games.length > 0) {
        console.log("Game Row Length (JSON):", JSON.stringify(games[0]).length);
    }

    console.log("Fetching sample Profile (Avatar)...");
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('avatar_url').limit(5);
    if (profiles) {
        profiles.forEach(p => {
            console.log("Avatar URL Length:", p.avatar_url ? p.avatar_url.length : 0);
            if (p.avatar_url && p.avatar_url.length > 200) {
                console.log("WARNING: Long Avatar URL found (starts with):", p.avatar_url.substring(0, 50));
            }
        });
    }
}

checkRowSizes();
