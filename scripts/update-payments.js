
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updatePayment(namePattern, status) {
    console.log(`\nUpdating ${namePattern} to ${status}...`);

    // 1. Find the player
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', namePattern);

    if (profileError) {
        console.error('Error finding profile:', profileError);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log(`No player found matching "${namePattern}"`);
        return;
    }

    const player = profiles[0];
    console.log(`Found player: ${player.full_name} (${player.id})`);

    // 2. Update league_players
    const { error: updateError } = await supabase
        .from('league_players')
        .update({ payment_status: status })
        .eq('player_id', player.id);

    if (updateError) {
        console.error('Error updating payment status:', updateError);
    } else {
        console.log(`Successfully updated payment status for ${player.full_name}`);
    }
}

async function main() {
    await updatePayment('Player 2', 'unpaid');
    await updatePayment('Player 13', 'paid_cash');
    await updatePayment('Player 16', 'waived');
}

main();
