require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSignatures() {
    console.log("Fetching a profile to test signatures...");
    
    // Pick first profile
    const { data: profiles, error: err1 } = await supabase.from('profiles').select('id, email, bylaws_agreed').limit(1);
    if (err1) {
        console.error("Error fetching", err1);
        return;
    }
    
    const profile = profiles[0];
    console.log(`Original state for ${profile.email}: agreed = ${profile.bylaws_agreed}`);
    
    // Test signing
    console.log("Simulating a signature update...");
    const { error: err2 } = await supabase.from('profiles').update({ bylaws_agreed: true }).eq('id', profile.id);
    if (err2) {
        console.error("Error updating", err2);
        return;
    }
    
    // Fetch again
    const { data: updated, error: err3 } = await supabase.from('profiles').select('bylaws_agreed').eq('id', profile.id).single();
    console.log(`Updated state for ${profile.email}: agreed = ${updated.bylaws_agreed}`);
    
    // Reset back
    if (!profile.bylaws_agreed) {
        await supabase.from('profiles').update({ bylaws_agreed: false }).eq('id', profile.id);
        console.log("Reset state back to original.");
    }
}
testSignatures();
