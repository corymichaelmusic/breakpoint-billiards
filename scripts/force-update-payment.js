
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function forceUpdate() {
    const playerId = 'player_bulk_13';
    const targetStatus = 'paid_cash';
    console.log(`Forcing update for ${playerId} to '${targetStatus}'...`);

    // 1. Fetch rows first
    const { data: rows, error: fetchError } = await supabase
        .from('league_players')
        .select('league_id, player_id, payment_status')
        .eq('player_id', playerId);

    if (fetchError) {
        console.error('Fetch Error:', fetchError);
        return;
    }

    console.log(`Found ${rows.length} rows to update.`);

    // 2. Update each row
    for (const row of rows) {
        console.log(`Updating league ${row.league_id}...`);
        const { data, error } = await supabase
            .from('league_players')
            .update({ payment_status: targetStatus })
            .eq('league_id', row.league_id)
            .eq('player_id', row.player_id)
            .select();

        if (error) {
            console.error(`  Error updating ${row.league_id}:`, error);
        } else {
            console.log(`  Updated: ${data.length} row(s). New status: ${data[0]?.payment_status}`);
        }
    }
}

forceUpdate();
