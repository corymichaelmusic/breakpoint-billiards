const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // Find players first to be absolutely sure
    const { data: p1 } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%Michael Moschella%').single();
    const { data: p2 } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%John Askew%').single();
    
    if (!p1 || !p2) {
        console.log("Players not found");
        return;
    }

    console.log("Michael ID:", p1.id);
    console.log("John ID:", p2.id);

    // Find match in week 4
    const { data: matches } = await supabase.from('matches')
        .select('*')
        .eq('week_number', 4)
        .or(`and(player1_id.eq.${p1.id},player2_id.eq.${p2.id}),and(player1_id.eq.${p2.id},player2_id.eq.${p1.id})`);

    if (!matches || matches.length === 0) {
        console.log("No week 4 match found");
        return;
    }

    const m = matches[0];
    console.log("--- Match ---");
    console.log("ID:", m.id);
    console.log("8-Ball Race:", m.race_to_8ball_p1, "to", m.race_to_8ball_p2);
    console.log("8-Ball Score:", m.points_8ball_p1, "to", m.points_8ball_p2);
    console.log("8-Ball Winner ID:", m.winner_id_8ball);

    const { data: games } = await supabase.from('games').select('*').eq('match_id', m.id).order('game_number', { ascending: true });
    console.log("\n--- Games ---");
    (games || []).forEach(g => {
        const winner = g.winner_id === p1.id ? "Michael" : (g.winner_id === p2.id ? "John" : "Other");
        console.log(`Game ${g.game_number} (${g.game_type}): Winner: ${winner}, Score: ${g.score_p1}-${g.score_p2}`);
    });
}
run();
