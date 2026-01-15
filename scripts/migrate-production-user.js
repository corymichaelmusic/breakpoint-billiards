
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../mobile/.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // MUST use Service Key to bypass RLS and Auth checks

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase URL or Service Role Key in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateUserByEmail(email) {
    console.log(`\n🔍 Starting Migration for email: ${email}`);

    // 1. Fetch all profiles with this email
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email);

    if (error) {
        console.error("Error fetching profiles:", error);
        return;
    }

    if (!profiles || profiles.length < 2) {
        console.log("ℹ️ Less than 2 profiles found. No migration needed (or user not signed in yet). found:", profiles?.length);
        console.log("Profiles found:", profiles);
        return;
    }

    console.log(`✅ Found ${profiles.length} profiles.`);

    // 2. Identify Old and New IDs
    // We assume the one with NO related data (or created most recently) is the NEW one.
    // Or simpler: The one that matches the Clerk ID provided? 
    // Since we don't have the Clerk ID explicitly here without calling Clerk API, 
    // let's look at creation time or data emptiness.

    // Actually, the OLD one will have data in 'league_players'.
    // Let's check which ID has league_players.

    let oldProfile = null;
    let newProfile = null;

    for (const p of profiles) {
        const { count } = await supabase
            .from('league_players')
            .select('*', { count: 'exact', head: true })
            .eq('player_id', p.id);

        console.log(`Profile ${p.id} has ${count} league_players entries.`);

        if (count > 0) {
            oldProfile = p;
        } else {
            newProfile = p;
        }
    }

    if (!oldProfile || !newProfile) {
        console.error("❌ Could not distinguish Old vs New profile. (Maybe both have data, or neither?)");
        // Fallback: Use created_at? Oldest is old.
        profiles.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        oldProfile = profiles[0];
        newProfile = profiles[profiles.length - 1]; // Newest
        console.log(`⚠️ Fallback: Assuming Oldest is OLD (${oldProfile.id}) and Newest is NEW (${newProfile.id}).`);
    }

    console.log(`\n🔄 MIGRATING DATA:`);
    console.log(`FROM Old ID: ${oldProfile.id}`);
    console.log(`TO   New ID: ${newProfile.id}`);

    const oldId = oldProfile.id;
    const newId = newProfile.id;

    // 3. Update Tables
    const tables = [
        { name: 'league_players', col: 'player_id' },
        { name: 'matches', col: 'player1_id' },
        { name: 'matches', col: 'player2_id' },
        { name: 'matches', col: 'winner_id_8ball' },
        { name: 'matches', col: 'winner_id_9ball' },
        { name: 'tournament_participants', col: 'player_id' },
        { name: 'tournaments', col: 'organizer_id' },
        { name: 'reschedule_requests', col: 'requester_id' }
    ];

    for (const t of tables) {
        const { error: updateError, count } = await supabase
            .from(t.name)
            .update({ [t.col]: newId })
            .eq(t.col, oldId);

        if (updateError) console.error(`Failed to update ${t.name}.${t.col}:`, updateError.message);
        else console.log(`✅ Updated ${count || '?'} rows in ${t.name}.${t.col}`);
    }

    // 4. Merge Profile Data (Optional - Keep nickname/stats from old?)
    // We should keep the OLD profile data (ratings, nickname) and put it on the NEW profile.
    // The NEW profile (from Sync) likely has name from email, but empty ratings.

    const updates = {};
    if (oldProfile.fargo_rating) updates.fargo_rating = oldProfile.fargo_rating;
    if (oldProfile.breakpoint_rating) updates.breakpoint_rating = oldProfile.breakpoint_rating;
    if (oldProfile.nickname) updates.nickname = oldProfile.nickname;
    if (oldProfile.avatar_url && !newProfile.avatar_url) updates.avatar_url = oldProfile.avatar_url;

    if (Object.keys(updates).length > 0) {
        const { error: pError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', newId);
        if (pError) console.error("Error merging profile stats:", pError);
        else console.log("✅ Merged profile stats (ratings/nickname) to New ID.");
    }

    // 5. Delete Old Profile
    const { error: delError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', oldId);

    if (delError) {
        console.error("❌ Error deleting old profile (Foreign Key restriction?):", delError.message);
        console.log("You may need to manually delete it or check other dependencies.");
    } else {
        console.log("🗑️ Deleted Old Profile.");
    }

    console.log("\n✨ Migration Complete!");
}

// Run the migration
migrateUserByEmail('corymichaelmusic@gmail.com');
