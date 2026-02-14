require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { createClerkClient } = require('@clerk/backend');

const coryMichaelId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function deleteCoryMichael() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

    console.log(`Starting deletion for Cory Michael (${coryMichaelId})...`);

    // 1. Delete from league_operators
    const { error: loError } = await supabase
        .from('league_operators')
        .delete()
        .eq('user_id', coryMichaelId);

    if (loError) {
        console.error(`- Error deleting operator assignments:`, loError.message);
    } else {
        console.log(`- Deleted operator assignments`);
    }

    // 2. Delete from profiles
    const { error: pError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', coryMichaelId);

    if (pError) {
        console.error(`- Error deleting profile from Supabase:`, pError.message);
    } else {
        console.log(`- Deleted profile from Supabase`);
    }

    // 3. Delete from Clerk
    try {
        await clerk.users.deleteUser(coryMichaelId);
        console.log(`- Deleted user from Clerk`);
    } catch (cError) {
        if (cError.status === 404) {
            console.log(`- User already deleted from Clerk or ID doesn't exist in this environment (404)`);
        } else {
            console.error(`- Error deleting user from Clerk:`, cError.message || cError);
        }
    }

    console.log('\nDeletion completed.');
}

deleteCoryMichael();
