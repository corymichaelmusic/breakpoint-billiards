
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function findUser() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: users, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .like('id', 'user_%')
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Found potential real users:');
    console.table(users);
}

findUser();
