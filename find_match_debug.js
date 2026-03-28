const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // Find players
    const { data: p1 } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%Michael Moschella%').single();
    const { data: p2 } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%John Askew%').single();
    
    // Find match in week 4
    const { data: matches } = await supabase.from('matches')
        .select('*')
        .eq('week_number', 4)
        .or(`and(player1_id.eq.${p1.id},player2_id.eq.${p2.id}),and(player1_id.eq.${p2.id},player2_id.eq.${p1.id})`);

    if (matches && matches.length > 0) {
        const m = matches[0];
        console.log("MATCH_ID=" + m.id);
        console.log("MICHAEL_ID=" + p1.id);
        console.log("JOHN_ID=" + p2.id);
    }
}
run();
