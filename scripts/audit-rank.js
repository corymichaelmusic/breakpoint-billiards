const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TARGET_EMAIL = 'corymichaelmusic@gmail.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditRank() {
    console.log("Starting Rank Audit...");

    // 1. Get User
    const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', TARGET_EMAIL) // Using email to find ID since we don't know it for sure in script
        // If profile doesn't have email in this table, we need to find by name 'Cory'
        .limit(1)
        .maybeSingle();

    if (pError) console.error("Profile Error:", pError);
    if (!profile) {
        // Try fallback fetch by querying distinct users from matches?
        // Or assume ID from previous script output: user_38V3SHW8bD9FbFb8qJGyzLme7kM
        console.log("Could not find profile by email. Trying hardcoded ID...");
    }

    // Hardcode ID from previous log if needed, or stick with profile
    // From step 124 log: P1: user_38V3SHW8bD9FbFb8qJGyzLme7kM
    const userId = profile?.id || 'user_38V3SHW8bD9FbFb8qJGyzLme7kM';
    const userRating = profile?.breakpoint_rating || 500;
    const userName = profile?.full_name || 'Unknown';

    console.log(`User: ${userName} (${userId})`);
    console.log(`Rating: ${userRating}`);

    // 2. Count Higher Ranked
    const { count, data: higherProfiles, error: hError } = await supabase
        .from('profiles')
        .select('id, full_name, breakpoint_rating', { count: 'exact' })
        .gt('breakpoint_rating', userRating)
        .order('breakpoint_rating', { ascending: false });

    if (hError) console.error("Higher Rank Error:", hError);

    console.log(`Higher Ranked Count: ${count}`);
    console.log(`Calculated Rank: ${(count || 0) + 1}`);

    if (higherProfiles && higherProfiles.length > 0) {
        console.log("Profiles ranked higher:");
        higherProfiles.forEach(p => console.log(` - ${p.full_name} (${p.breakpoint_rating})`));
    } else {
        console.log("No profiles ranked higher.");
    }

    // 3. Check for "Header" or Weird Profiles
    const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, breakpoint_rating')
        .order('breakpoint_rating', { ascending: false })
        .limit(5);

    console.log("--- Top 5 Global Profiles ---");
    allProfiles.forEach(p => console.log(`${p.full_name}: ${p.breakpoint_rating}`));

}

auditRank();
