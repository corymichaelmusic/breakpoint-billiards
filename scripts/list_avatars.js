const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listFiles() {
    console.log("Listing 'avatars' bucket contents...");

    // List top level folders (users)
    const { data: users, error: userError } = await supabase.storage.from('avatars').list();

    if (userError) {
        console.error("Error listing users:", userError);
        return;
    }

    if (!users || users.length === 0) {
        console.log("No user folders found.");
        return;
    }

    for (const userFolder of users) {
        // Skip .emptyFolderPlaceholder if it exists
        if (userFolder.name.startsWith('.')) continue;

        const { data: files, error: fileError } = await supabase.storage
            .from('avatars')
            .list(userFolder.name);

        if (fileError) {
            console.error(`Error listing files for ${userFolder.name}:`, fileError);
            continue;
        }

        console.log(`\nUser Folder: ${userFolder.name}`);
        if (files.length === 0) {
            console.log("  (Empty)");
        } else {
            files.forEach(f => {
                console.log(`  - ${f.name} \t(${Math.round(f.metadata.size / 1024)} KB) \tCreated: ${f.created_at}`);
            });
            if (files.length > 1) {
                console.warn(`  ⚠️  WARNING: Multiple files found! Cleanup might failed.`);
            } else {
                console.log(`  ✅  Clean (1 file)`);
            }
        }
    }
}

listFiles();
