const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function demoteUser() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Hardcoded from previous Clerk fetch to ensure success
    const userId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'player' })
        .eq('id', userId)
        .select();

    if (error) {
        console.error('Error updating profile:', error);
    } else {
        console.log('Successfully updated profile to player:', data);
    }
}

demoteUser();
