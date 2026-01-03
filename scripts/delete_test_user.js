
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' }); // Try to load env vars

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Note: To delete, we generally need the SERVICE_ROLE_KEY if RLS blocks deletion, 
// or the user must be deleting themselves. 
// Since I assume I'm running this as an admin script, I need full access.
// If SERVICE_ROLE_KEY is not in .env.local, this might fail with standard RLS if I'm not authenticated as that user.
// However, I can try. 

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key. Make sure .env.local exists and has EXPO_PUBLIC_SUPABASE_URL.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteUser() {
    const email = 'breakpointbilliardstesting@gmail.com';
    console.log(`Searching for user: ${email}...`);

    // 1. Get User ID
    const { data: profiles, error: findError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email);

    if (findError) {
        console.error('Error finding user:', findError);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('User not found in public.profiles.');
        return;
    }

    const userId = profiles[0].id;
    console.log(`Found user ${userId}. Deleting...`);

    // 2. Delete from Profiles (Cascade should handle the rest if configured, but let's be sure)
    // We might need to delete related data first if no cascade.
    // "fix_profiles_id_text_v6_dynamic.sql" re-added FKs. Did it add 'ON DELETE CASCADE'?
    // Usually manually re-added keys default to NO ACTION unless specified.
    // I should try to delete and see.

    const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

    if (deleteError) {
        console.error('Error deleting user:', deleteError);
    } else {
        console.log('User successfully deleted from Supabase profiles.');
    }

    // NOTE: This does NOT delete from auth.users (Supabase Auth) or Clerk.
}

deleteUser();
