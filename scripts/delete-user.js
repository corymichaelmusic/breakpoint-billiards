require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function deleteUser() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find user by email
    const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', 'cory.hinkley@gmail.com')
        .single();

    if (findError) {
        console.log('Error finding user:', findError.message);
        return;
    }

    if (!profile) {
        console.log('User not found');
        return;
    }

    console.log('Found user:', profile);

    // Delete the profile
    const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id);

    if (deleteError) {
        console.log('Error deleting:', deleteError.message);
    } else {
        console.log('Successfully deleted user from Supabase');
    }
}

deleteUser();
