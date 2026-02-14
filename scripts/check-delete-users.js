require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const emails = [
    'ctsvmz2d8b@privaterelay.appleid.com',
    'qbeam09@gmail.com',
    'peytonneal23@gmail.com',
    'wf5vdnbgkg@privaterelay.appleid.com'
];

async function checkUsers() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Checking for users in Supabase...');

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('email', emails);

    if (error) {
        console.error('Error fetching profiles:', error.message);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('No matching users found in Supabase.');
    } else {
        console.log('Found users:');
        profiles.forEach(p => console.log(`- ${p.full_name} (${p.email}) ID: ${p.id}`));
    }
}

checkUsers();
