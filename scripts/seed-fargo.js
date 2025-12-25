const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function seedFargo() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Update all profiles with a random Fargo rating between 300 and 700
    const { data: profiles } = await supabase.from('profiles').select('id');

    if (!profiles) return;

    for (const p of profiles) {
        const rating = Math.floor(Math.random() * (700 - 300 + 1)) + 300;
        await supabase.from('profiles').update({ fargo_rating: rating }).eq('id', p.id);
    }

    console.log('Seeded Fargo ratings for', profiles.length, 'profiles');
}

seedFargo();
