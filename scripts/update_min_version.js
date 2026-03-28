const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function updateMinimumVersion() {
    try {
        const env = fs.readFileSync('.env.local', 'utf8');
        const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
        const srkMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

        if (!urlMatch || !srkMatch) {
            console.error('URL or Service Role Key missing from .env.local');
            process.exit(1);
        }

        const supabase = createClient(urlMatch[1], srkMatch[1]);

        const { data, error } = await supabase
            .from('system_settings')
            .update({ value: '1.1.1' })
            .eq('key', 'minimum_mobile_version')
            .select();

        if (error) {
            console.error('Failed to update:', error);
            process.exit(1);
        }

        console.log('Update Complete:', data);
        process.exit(0);
    } catch (error) {
        console.error('Error in script:', error);
        process.exit(1);
    }
}

updateMinimumVersion();
