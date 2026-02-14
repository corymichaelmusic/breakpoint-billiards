const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkMessages() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Checking messages table structure...');

    // Using a select with limit 0 to get column names and types if possible via JS error or sample
    // But since I can't easily get metadata via JS client, I'll try to find the create-messages-table.js script
    const { data, error } = await supabase.from('messages').select('*').limit(1);

    if (error) {
        console.error('Error fetching message:', error);
    } else {
        console.log('Sample message:', data[0]);
    }
}

checkMessages();
