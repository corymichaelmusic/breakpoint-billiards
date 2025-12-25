const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listSessions() {
    const { data: sessions } = await supabase.from('leagues').select('id, name, created_at, status').eq('type', 'session');
    console.log('Sessions:', sessions);
}
listSessions();
