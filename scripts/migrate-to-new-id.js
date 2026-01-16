const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables - try multiple locations
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../mobile/.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase URL or Service Role Key in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const NEW_ID = 'user_38GKAWlAxWgwMuoirhNpUxHRwWM';
const EMAIL = 'corymichaelmusic@gmail.com';

async function migrate() {
    console.log('🔍 Finding profiles with email:', EMAIL);

    // Find all profiles with this email
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', EMAIL);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Found', profiles?.length || 0, 'profiles:');
    profiles?.forEach(p => console.log('  -', p.id, '| nickname:', p.nickname, '| rating:', p.breakpoint_rating));

    // Find old IDs (any that aren't the new ID)
    const oldIds = profiles?.filter(p => p.id !== NEW_ID).map(p => p.id) || [];
    console.log('\nOld IDs to migrate:', oldIds);

    if (oldIds.length === 0) {
        console.log('✅ No old IDs found - you may already be migrated!');
        return;
    }

    // Get old profile data to preserve (use first old profile with data)
    const oldProfile = profiles?.find(p => p.id !== NEW_ID);

    // Check if new profile exists
    const newProfile = profiles?.find(p => p.id === NEW_ID);

    if (!newProfile) {
        console.log('\n⚠️ New profile (', NEW_ID, ') not found in DB.');
        console.log('Creating new profile with migrated data...');

        // Create new profile with old data
        const { error: createError } = await supabase
            .from('profiles')
            .insert({
                id: NEW_ID,
                email: EMAIL,
                nickname: oldProfile?.nickname,
                fargo_rating: oldProfile?.fargo_rating,
                breakpoint_rating: oldProfile?.breakpoint_rating,
                avatar_url: oldProfile?.avatar_url,
                role: oldProfile?.role || 'member'
            });

        if (createError) {
            console.error('❌ Error creating new profile:', createError);
            return;
        }
        console.log('✅ Created new profile');
    }

    // Update all tables
    console.log('\n🔄 Migrating data from old IDs to new ID...\n');

    const tables = [
        { name: 'league_players', col: 'player_id' },
        { name: 'matches', col: 'player1_id' },
        { name: 'matches', col: 'player2_id' },
        { name: 'matches', col: 'winner_id_8ball' },
        { name: 'matches', col: 'winner_id_9ball' },
        { name: 'tournament_participants', col: 'player_id' },
        { name: 'tournaments', col: 'organizer_id' },
        { name: 'reschedule_requests', col: 'requester_id' },
        { name: 'league_operators', col: 'user_id' }
    ];

    for (const oldId of oldIds) {
        console.log(`\n--- Migrating from ${oldId} ---`);

        for (const t of tables) {
            const { data, error: updateError } = await supabase
                .from(t.name)
                .update({ [t.col]: NEW_ID })
                .eq(t.col, oldId)
                .select();

            if (updateError) {
                console.error(`  ❌ ${t.name}.${t.col}:`, updateError.message);
            } else {
                const count = data?.length || 0;
                if (count > 0) {
                    console.log(`  ✅ Updated ${count} rows in ${t.name}.${t.col}`);
                }
            }
        }

        // Merge profile data if new profile was empty
        if (newProfile && oldProfile) {
            const updates = {};
            if (oldProfile.fargo_rating && !newProfile.fargo_rating) updates.fargo_rating = oldProfile.fargo_rating;
            if (oldProfile.breakpoint_rating && !newProfile.breakpoint_rating) updates.breakpoint_rating = oldProfile.breakpoint_rating;
            if (oldProfile.nickname && !newProfile.nickname) updates.nickname = oldProfile.nickname;
            if (oldProfile.avatar_url && !newProfile.avatar_url) updates.avatar_url = oldProfile.avatar_url;
            if (oldProfile.role && oldProfile.role !== 'member') updates.role = oldProfile.role;

            if (Object.keys(updates).length > 0) {
                const { error: pError } = await supabase
                    .from('profiles')
                    .update(updates)
                    .eq('id', NEW_ID);
                if (pError) console.error("  ❌ Error merging profile stats:", pError);
                else console.log("  ✅ Merged profile stats (ratings/nickname) to new ID");
            }
        }

        // Delete old profile
        const { error: delError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', oldId);

        if (delError) {
            console.error(`  ⚠️ Could not delete old profile ${oldId}:`, delError.message);
        } else {
            console.log(`  🗑️ Deleted old profile ${oldId}`);
        }
    }

    console.log('\n✨ Migration Complete!');

    // Verify
    console.log('\n🔍 Verifying...');
    const { data: finalProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', NEW_ID)
        .single();

    console.log('Final profile:', JSON.stringify(finalProfile, null, 2));
}

migrate();
