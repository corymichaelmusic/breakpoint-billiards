const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectLeagues() {
    console.log("--- Fetching Leagues with Bounty Values ---");
    const { data: leagues, error } = await supabase
        .from('leagues')
        .select('id, name, type, bounty_val_8_run, bounty_val_9_run, bounty_val_9_snap, bounty_val_shutout');

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (leagues) {
        leagues.forEach(l => {
            console.log(`[${l.type}] ${l.name} (${l.id})`);
            console.log(`   8 Run: ${l.bounty_val_8_run}`);
            console.log(`   9 Run: ${l.bounty_val_9_run}`);
            console.log(`   9 Snap: ${l.bounty_val_9_snap}`);
            console.log(`   Shutout: ${l.bounty_val_shutout}`);
            console.log("------------------------------------------------");
        });
    }
}

(async () => {
    await inspectLeagues();
})();
