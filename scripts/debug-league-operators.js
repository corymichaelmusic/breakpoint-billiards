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

async function debug() {
    // 1. Show league_operators entries
    console.log("\n📋 league_operators table:");
    const { data: operators, error: opError } = await supabase
        .from('league_operators')
        .select('*');
    console.table(operators);
    if (opError) console.error(opError);

    // 2. Show profiles with email
    console.log("\n📋 Profiles for corymichaelmusic@gmail.com:");
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('email', 'corymichaelmusic@gmail.com');
    console.table(profiles);

    // 3. Show leagues
    console.log("\n📋 Leagues:");
    const { data: leagues } = await supabase
        .from('leagues')
        .select('id, name, type, status, operator_id')
        .eq('type', 'league');
    console.table(leagues);
}

debug();
