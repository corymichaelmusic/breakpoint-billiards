
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
    const matchId = '1949f32a-c015-4bb1-8581-f767eac679c3';
    console.log(`Updating match ${matchId}...`);

    const { data, error } = await supabase
        .from('matches')
        .update({ winner_id_8ball: 'TEST_WINNER' })
        .eq('id', matchId)
        .select();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Update success:', data);
    }
}

testUpdate();
