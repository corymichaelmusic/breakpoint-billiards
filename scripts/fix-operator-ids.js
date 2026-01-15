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

// Add BOTH profile IDs to league_operators for Money Mondays
const LEAGUE_ID = '9c914ef5-8a23-4f24-b163-444c8a05def6';
const USER_IDS = [
    'user_38GKAWlAxWgwMuoirhNpUxHRwWM',
    'user_36G4WUMW9oc8aohN8s6FQUX6Xe9'
];

async function addBothOperators() {
    console.log("\n🔧 Adding both user IDs to league_operators...\n");

    for (const userId of USER_IDS) {
        // Check if already exists
        const { data: existing } = await supabase
            .from('league_operators')
            .select('*')
            .eq('league_id', LEAGUE_ID)
            .eq('user_id', userId)
            .maybeSingle();

        if (existing) {
            console.log(`ℹ️ ${userId} already in league_operators.`);
            continue;
        }

        const { error } = await supabase
            .from('league_operators')
            .insert({
                league_id: LEAGUE_ID,
                user_id: userId,
                role: 'admin'
            });

        if (error) {
            console.error(`❌ Error adding ${userId}:`, error.message);
        } else {
            console.log(`✅ Added ${userId} to league_operators.`);
        }
    }

    // Also update the leagues table operator_id to match the CURRENT clerk ID
    // (The one starting with 36G4 seems to be the older one based on previous script output)
    console.log("\n📋 Final league_operators:");
    const { data: operators } = await supabase
        .from('league_operators')
        .select('*')
        .eq('league_id', LEAGUE_ID);
    console.table(operators);

    console.log("\n✨ Done!");
}

addBothOperators();
