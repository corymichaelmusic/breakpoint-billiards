const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function promoteToAdmin() {
    const email = 'corymichaelmusic@gmail.com'; // Target user

    console.log(`Promoting ${email} to 'admin'...`);

    const { data, error } = await supabase
        .from('profiles')
        .update({
            role: 'admin',
            operator_status: 'approved' // Ensure they are approved as well
        })
        .eq('email', email)
        .select();

    if (error) {
        console.error('Error updating role:', error);
    } else {
        console.log('Success! User promoted:', data);
    }
}

promoteToAdmin();
