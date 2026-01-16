const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteUser() {
    const email = 'cory.hinkley@gmail.com';
    console.log('Searching for user:', email);

    const { data: profiles, error: findError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', email);

    if (findError) {
        console.error('Error finding user:', findError);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('User not found in profiles table.');
        return;
    }

    const userId = profiles[0].id;
    console.log('Found user:', profiles[0]);
    console.log('Deleting league_players...');

    await supabase.from('league_players').delete().eq('player_id', userId);

    console.log('Deleting games for matches...');
    const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);

    if (matches && matches.length > 0) {
        const matchIds = matches.map(m => m.id);
        await supabase.from('games').delete().in('match_id', matchIds);
        console.log('Deleting matches...');
        await supabase.from('matches').delete().or(`player1_id.eq.${userId},player2_id.eq.${userId}`);
    }

    console.log('Updating submitted_by references...');
    await supabase.from('matches').update({ submitted_by: null }).eq('submitted_by', userId);

    console.log('Deleting reschedule_requests...');
    await supabase.from('reschedule_requests').delete().eq('requester_id', userId);

    console.log('Deleting profile...');
    const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

    if (deleteError) {
        console.error('Error deleting profile:', deleteError);
    } else {
        console.log(`User ${email} successfully deleted from Supabase.`);
    }
}

deleteUser();
