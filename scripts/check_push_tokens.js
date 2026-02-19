const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    console.log('URL:', supabaseUrl ? 'Set' : 'Missing');
    console.log('Key:', supabaseServiceKey ? 'Set' : 'Missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTokens() {
    console.log("Checking for users with push tokens...");

    // 1. Count users with tokens
    const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('push_token', 'is', null);

    if (countError) {
        console.error("Error counting tokens:", countError);
        return;
    }

    console.log(`Total users with push tokens: ${count}`);

    // 2. List a few examples
    const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, push_token')
        .not('push_token', 'is', null)
        .limit(5);

    if (usersError) {
        console.error("Error fetching users:", usersError);
        return;
    }

    console.log("Sample users with tokens:");
    users.forEach(u => console.log(`- ${u.full_name}: ${u.push_token ? u.push_token.substring(0, 20) + '...' : 'null'}`));

    // 3. Check active league players
    console.log("\nChecking active league players for push tokens...");

    const { data: players, error: playersError } = await supabase
        .from('league_players')
        .select(`
          status,
          league_id,
          player_id,
          profiles:player_id(full_name, push_token, is_active)
      `)
        .eq('status', 'active')
        .limit(10);

    if (playersError) {
        console.error("Error fetching league players:", playersError);
    } else {
        // Need to handle if profiles is an array or object depending on relationship
        const getProfile = (p) => Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;

        const playersWithTokens = players.filter(p => {
            const profile = getProfile(p);
            return profile && profile.push_token;
        });

        console.log(`Checked ${players.length} active players. Found ${playersWithTokens.length} with tokens.`);

        // Force check for Cory
        const { data: corys, error: coryError } = await supabase
            .from('profiles')
            .select('id, full_name, push_token')
            .ilike('full_name', '%Cory%');

        if (corys && corys.length > 0) {
            console.log(`\n[DIRECT CHECK] Found ${corys.length} users named Cory:`);
            corys.forEach(c => {
                console.log(`\n- Name: ${c.full_name}, ID: ${c.id}`);
                console.log(`  Token: '${c.push_token}'`);
                console.log(`  Is Null? ${c.push_token === null}`);
            });
        } else {
            console.log("\n[DIRECT CHECK] Could not find user with name like 'Cory'");
            if (coryError) console.error(coryError);
        }
    }
}

checkTokens();
