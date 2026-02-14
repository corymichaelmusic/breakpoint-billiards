require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { createClerkClient } = require('@clerk/backend');

const userIds = [
    'user_38gSzTJhxDpEAsKibijWzCxZRE1', // wf5vdnbgkg@privaterelay.appleid.com
    'user_38VH2mzSnhuvUtEHfoMukz0ZmdP', // peytonneal23@gmail.com
    'user_38V8MV9EpEnIbKAeb6mOCjtrUHS', // ctsvmz2d8b@privaterelay.appleid.com
    'user_38V7Vlzg7uLY2ssFDXn1VE8he51'  // qbeam09@gmail.com
];

async function deleteUsers() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

    console.log('Starting deletion process...');

    for (const uid of userIds) {
        console.log(`\nProcessing user: ${uid}`);

        // 1. Delete from league_players
        const { error: lpError } = await supabase
            .from('league_players')
            .delete()
            .eq('player_id', uid);

        if (lpError) {
            console.error(`- Error deleting league memberships for ${uid}:`, lpError.message);
        } else {
            console.log(`- Deleted league memberships for ${uid}`);
        }

        // 2. Delete from profiles
        const { error: pError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', uid);

        if (pError) {
            console.error(`- Error deleting profile for ${uid}:`, pError.message);
        } else {
            console.log(`- Deleted profile for ${uid} from Supabase`);
        }

        // 3. Delete from Clerk
        try {
            await clerk.users.deleteUser(uid);
            console.log(`- Deleted user ${uid} from Clerk`);
        } catch (cError) {
            if (cError.status === 404) {
                console.log(`- User ${uid} already deleted from Clerk (404)`);
            } else {
                console.error(`- Error deleting user ${uid} from Clerk:`, cError.message || cError);
            }
        }
    }

    console.log('\nDeletion process completed.');
}

deleteUsers();
