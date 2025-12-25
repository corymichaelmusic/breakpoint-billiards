
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('Service Key Length:', supabaseServiceKey ? supabaseServiceKey.length : 0);

async function debugAccess() {
    const { count, error } = await supabase.from('league_players').select('*', { count: 'exact', head: true });
    if (error) console.error('Total Count Error:', error);
    else console.log('Total league_players rows:', count);
}

async function updatePlayer(name, status) {
    // ... existing code ...
    console.log(`\nProcessing ${name} -> ${status}...`);

    // 1. Find Profile
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', name);

    if (!profiles || profiles.length === 0) {
        console.log(`  No profile found for "${name}"`);
        return;
    }

    const player = profiles[0];
    console.log(`  Found Profile: ${player.full_name} (${player.id})`);

    // 2. Fetch League Records
    const { data: records, error: fetchError } = await supabase
        .from('league_players')
        .select('league_id, player_id, payment_status')
        .eq('player_id', player.id);

    if (fetchError) {
        console.error('  Fetch Error:', fetchError);
        return;
    }

    console.log(`  Found ${records.length} league records.`);

    // 3. Update Each Record
    for (const record of records) {
        // console.log(`    Updating league ${record.league_id}...`);
        const { data, error } = await supabase
            .from('league_players')
            .update({ payment_status: status })
            .eq('league_id', record.league_id)
            .eq('player_id', record.player_id)
            .select();

        if (error) {
            console.error(`    Error updating ${record.league_id}:`, error);
        } else {
            const newStatus = data[0]?.payment_status;
            console.log(`    Updated ${record.league_id}: ${record.payment_status} -> ${newStatus}`);
        }
    }
}

async function main() {
    await debugAccess();
    await updatePlayer('Player 2', 'unpaid');
    await updatePlayer('Player 13', 'paid_cash');
    await updatePlayer('Player 16', 'waived');
}

main();
