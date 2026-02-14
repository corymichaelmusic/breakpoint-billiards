require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function findCoryDuplicates() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Finding Cory profiles...');

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'corymichaelmusic@gmail.com');

    if (error) {
        console.error('Error fetching profiles:', error.message);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('No profiles found for corymichaelmusic@gmail.com');
    } else {
        console.log('Found profiles:');
        profiles.forEach(p => {
            console.log(`- Name: ${p.full_name}, Email: ${p.email}, ID: ${p.id}, Created At: ${p.created_at}`);
        });
    }
}

findCoryDuplicates();
