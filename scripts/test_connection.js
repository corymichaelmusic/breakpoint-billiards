
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

console.log("Testing Supabase Connectivity...");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL is missing.");
} else {
    console.log(`URL: ${url}`);
}

if (!key) {
    console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY is missing.");
} else {
    console.log(`Key: ${key.substring(0, 5)}...`);
}

if (url && key) {
    const supabase = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    supabase.from('profiles').select('count', { count: 'exact', head: true })
        .then(({ count, error }) => {
            if (error) {
                console.error("Connection Failed:", error);
            } else {
                console.log("Connection Successful! Profiles count:", count);
            }
        })
        .catch(err => {
            console.error("Fetch Exception:", err);
        });
}
