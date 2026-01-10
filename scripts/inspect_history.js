const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function inspect() {
    console.log('--- Inspecting Tables ---');
    // Attempt to infer tables by querying a known one or using rpc if available. 
    // Since we don't have direct SQL access, we'll try to select * from likely tables limit 1

    const suspects = [
        'rating_history', 'ratings_history', 'player_rating_history',
        'player_ratings_history', 'history', 'logs', 'audit_logs',
        'league_players_history'
    ];

    for (const table of suspects) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (!error) {
            console.log(`FOUND TABLE: ${table}`);
            console.log('Columns:', Object.keys(data[0] || {}));
        }
    }

    console.log('--- Inspecting Matches Columns ---');
    const { data: matches, error: mErr } = await supabase.from('matches').select('*').limit(1);
    if (matches && matches.length > 0) {
        console.log('Matches Columns:', Object.keys(matches[0]));
    } else if (mErr) {
        console.error('Matches Error:', mErr);
    } else {
        console.log('Matches table is empty, cannot infer columns from data.');
    }
}

inspect();
