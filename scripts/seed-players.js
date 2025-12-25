const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function seedPlayers() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const players = [
        { id: 'player_1', email: 'player1@example.com', full_name: 'Alice Anderson', role: 'player' },
        { id: 'player_2', email: 'player2@example.com', full_name: 'Bob Baker', role: 'player' },
        { id: 'player_3', email: 'player3@example.com', full_name: 'Charlie Clark', role: 'player' },
        { id: 'player_4', email: 'player4@example.com', full_name: 'Diana Davis', role: 'player' },
    ];

    const { data, error } = await supabase
        .from('profiles')
        .upsert(players)
        .select();

    if (error) {
        console.error('Error seeding players:', error);
    } else {
        console.log('Successfully seeded players:', data);
    }
}

seedPlayers();
