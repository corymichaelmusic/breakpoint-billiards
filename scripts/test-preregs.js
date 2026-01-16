require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!sbUrl || !sbKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(sbUrl, sbKey);

async function main() {
    console.log('Fetching all preregistrations...');

    const { data, error, count } = await supabase
        .from('preregistrations')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`\nTotal count from DB: ${count}`);
    console.log(`Rows returned: ${data?.length}`);
    console.log('\nAll preregistrations:');
    data?.forEach((p, i) => {
        console.log(`${i + 1}. ${p.full_name} - ${p.email} - ${new Date(p.created_at).toLocaleDateString()}`);
    });
}

main().catch(console.error);
