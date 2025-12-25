const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function promoteUser() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Hardcoded from previous Clerk fetch to ensure success
    const userId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';
    const email = 'corymichaelmusic@gmail.com';
    const fullName = 'Cory Michael'; // Approximation, can be updated later

    const { data, error } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            email: email,
            full_name: fullName,
            role: 'admin',
            updated_at: new Date().toISOString(),
        })
        .select();

    if (error) {
        console.error('Error upserting profile:', error);
    } else {
        console.log('Successfully upserted operator profile:', data);
    }
}

promoteUser();
