
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updatePlayer(namePattern, status) {
    console.log(`\nProcessing ${namePattern} -> ${status}...`);

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', namePattern);

    if (!profiles || profiles.length === 0) {
        console.log('Player not found');
        return;
    }

    console.log(`Found ${profiles.length} profiles matching "${namePattern}"`);

    for (const player of profiles) {
        console.log(`\nChecking Profile: ${player.full_name} (${player.id})`);

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
            console.log(`  Found ${records.length} records. Updating...`);
            for (const r of records) {
                const { error: updateError } = await supabase
                    .from('league_players')
                    .update({ payment_status: status })
                    .eq('league_id', r.league_id)
                    .eq('player_id', player.id);

                if (updateError) console.error(`  Error updating ${r.league_id}:`, updateError);
                else console.log(`  Updated ${r.leagues?.name} to ${status}`);
            }
        }
    }
}

async function main() {
    await updatePlayer('Player 2', 'unpaid');
    await updatePlayer('Player 13', 'paid');
    await updatePlayer('Player 16', 'waived');
}

main();
