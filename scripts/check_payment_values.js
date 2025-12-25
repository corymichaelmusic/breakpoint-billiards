
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkValues() {
    const { data, error } = await supabase
        .from('league_players')
        .select('payment_status');

    if (error) console.error(error);
    else {
        const distinct = [...new Set(data.map(d => d.payment_status))];
        console.log("Distinct payment_status values:", distinct);
    }
}

checkValues();
