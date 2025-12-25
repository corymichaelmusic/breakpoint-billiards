
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectPlayer(namePattern) {
    console.log(`\nInspecting ${namePattern}...`);

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .ilike('full_name', namePattern);

    if (!profiles || profiles.length === 0) {
        console.log('Player not found');
        return;
    }

    console.log(`Found ${profiles.length} profiles matching "${namePattern}"`);

    for (const player of profiles) {
        console.log(`\nChecking Profile: ${player.full_name} (${player.id})`);
        console.log(`Avatar URL: ${player.avatar_url}`);

        const { data: records, error } = await supabase
            .from('league_players')
            .select(`
        league_id,
        payment_status,
        leagues (name, type)
        `)
            .eq('player_id', player.id);

        if (error) {
            console.error("Error:", error);
            continue;
        }

        if (records.length === 0) {
            console.log("  No league records found.");
        } else {
            console.table(records.map(r => ({
                league: r.leagues?.name,
                payment: r.payment_status
            })));
        }
    }
}

async function main() {
    await inspectPlayer('Cory Michael');
}

main();
