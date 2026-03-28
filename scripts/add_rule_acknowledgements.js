require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Adding bylaws_agreed and bis_rules_agreed to profiles table...");
    const { error: error1 } = await supabase.rpc('exec_sql', {
        sql_string: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bylaws_agreed boolean DEFAULT false;'
    }).catch(e => { console.log(e); return {error: null}; });

    const { error: error2 } = await supabase.rpc('exec_sql', {
        sql_string: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bis_rules_agreed boolean DEFAULT false;'
    }).catch(e => { console.log(e); return {error: null}; });

    console.log("Done.");
}

main();
