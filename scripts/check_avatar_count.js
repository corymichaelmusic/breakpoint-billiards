
console.log("Script starting...");
require('dotenv').config({ path: '.env.local' });
console.log("Environment loaded");
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAvatarCount() {
    const userName = "Cory Michael"; // Search term

    // 1. Find User ID
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .ilike('full_name', `%${userName}%`);

    if (profileError) {
        console.error('Error finding profile:', profileError);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log(`No profile found matching "${userName}"`);
        return;
    }

    for (const profile of profiles) {
        console.log(`\nChecking User: ${profile.full_name} (${profile.id})`);
        console.log(`Current Avatar URL: ${profile.avatar_url || 'None'}`);

        // 2. List Files in Storage
        // The folder structure is typically {userId}/{filename}
        // We list the "folder" corresponding to the userId
        const { data: files, error: storageError } = await supabase
            .storage
            .from('avatars')
            .list(profile.id);

        if (storageError) {
            console.error('Error listing storage:', storageError);
            continue;
        }

        if (!files || files.length === 0) {
            console.log(`No avatar files found in storage folder.`);
        } else {
            console.log(`Found ${files.length} file(s):`);
            files.forEach(f => {
                console.log(` - ${f.name} (${(f.metadata.size / 1024).toFixed(2)} KB) - Created: ${f.created_at}`);
            });
        }
    }
}

checkAvatarCount();
