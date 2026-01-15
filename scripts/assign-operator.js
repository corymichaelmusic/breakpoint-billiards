const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from root .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase URL or Service Role Key in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Breakpoint Billiards Money Monday league ID
const LEAGUE_ID = 'ad10328d-822b-4cc5-80ec-1cec4e3e373e';
const USER_EMAIL = 'corymichaelmusic@gmail.com';

async function assignOperator() {
    console.log(`\n🔍 Looking up user: ${USER_EMAIL}`);

    // 1. Find user by email (handle multiple results)
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('email', USER_EMAIL);

    if (profileError) {
        console.error("❌ Error fetching profiles:", profileError.message);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log("❌ No profiles found with that email.");
        console.log("\n📋 Listing all profiles with 'admin' or 'operator' role:");
        const { data: allProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .in('role', ['admin', 'operator']);
        console.table(allProfiles);
        return;
    }

    // Use the first profile (or the one most likely the production one)
    const profile = profiles[0];
    console.log(`✅ Found ${profiles.length} profile(s). Using: ${profile.full_name} (${profile.id})`);
    console.log(`   Current role: ${profile.role}`);

    // 2. First, list all leagues to find the correct one
    console.log("\n📋 Available leagues in database:");
    const { data: allLeagues } = await supabase
        .from('leagues')
        .select('id, name, status, type')
        .eq('type', 'league');
    console.table(allLeagues);

    // Find Money Mondays league
    const moneyMondaysLeague = allLeagues?.find(l =>
        l.name.toLowerCase().includes('money') ||
        l.name.toLowerCase().includes('breakpoint')
    );

    if (!moneyMondaysLeague) {
        console.error("❌ Could not find Money Mondays league in database.");
        return;
    }

    const leagueId = moneyMondaysLeague.id;
    console.log(`\n✅ Found league: ${moneyMondaysLeague.name} (${leagueId})`);

    // 3. Check if already an operator for this league
    const { data: existing } = await supabase
        .from('league_operators')
        .select('*')
        .eq('league_id', leagueId)
        .eq('user_id', profile.id)
        .maybeSingle();

    if (existing) {
        console.log("ℹ️ User is already an operator of this league.");
        return;
    }

    // 4. Add to league_operators
    const { error: insertError } = await supabase
        .from('league_operators')
        .insert({
            league_id: leagueId,
            user_id: profile.id,
            role: 'admin' // Full operator access
        });

    if (insertError) {
        console.error("❌ Error inserting into league_operators:", insertError.message);
        return;
    }

    console.log("✅ Successfully added as operator of Money Mondays league!");

    // 5. Verify the league info
    const { data: league } = await supabase
        .from('leagues')
        .select('name, status')
        .eq('id', leagueId)
        .single();

    if (league) {
        console.log(`\n📋 League: ${league.name} (Status: ${league.status})`);
    }

    console.log("\n✨ Done! You should now have operator access.");
}

assignOperator();
