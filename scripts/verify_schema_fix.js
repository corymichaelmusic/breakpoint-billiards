
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env vars manually to avoid dependencies
const envPath = path.join(__dirname, '../.env.local');
// Fallback to .env if .env.local doesn't exist
const activeEnvPath = fs.existsSync(envPath) ? envPath : path.join(__dirname, '../.env');

if (!fs.existsSync(activeEnvPath)) {
    console.error("❌ No .env file found at:", activeEnvPath);
    process.exit(1);
}

const envContent = fs.readFileSync(activeEnvPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/["']/g, ''); // Remove quotes
        env[key] = value;
    }
});

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFix() {
    console.log("🔍 Starting Smoke Test...");

    // 1. Try to fetch a profile (Confirm RLS doesn't crash)
    const { data: fetchResult, error: fetchError } = await supabase.from('profiles').select('id').limit(1);

    if (fetchError) {
        console.error("❌ Read Check Failed:", fetchError.message);
        // If it's the specific UUID error, we know it failed
        if (fetchError.message.includes("invalid input syntax for type uuid")) {
            console.error("🚨 CRITICAL: Database still expecting UUID!");
            return;
        }
    } else {
        console.log("✅ Read Check Passed (RLS allows select)");
    }

    // 2. Try to Insert a Profile with TEXT ID
    // We can't really "Insert" without a valid auth session normally due to RLS "Users can insert OWN profile"
    // So this writes will likely fail with "new row violates row-level security policy" 
    // BUT getting that error is GOOD. It means it parsed the ID type correctly.
    // If we get "invalid input syntax for type uuid", then the migration failed.

    const testId = "user_verification_test_" + Date.now();
    console.log(`Testing Insert with Text ID: ${testId}`);

    const { error: insertError } = await supabase.from('profiles').insert({
        id: testId,
        email: "test@verification.com",
        full_name: "Verification Bot",
        role: "player"
    });

    if (insertError) {
        if (insertError.message.includes("invalid input syntax for type uuid")) {
            console.error("🚨 CRITICAL FAIL: Column is still UUID!");
        } else if (insertError.message.includes("violates row-level security policy")) {
            console.log("✅ TYPE CHECK PASSED! (Blocked by RLS as expected, but Type was accepted)");
        } else {
            console.log("⚠️ Received unexpected error:", insertError.message);
            // It might be some other constraint, but if it's not UUID error, we are likely good on types.
            if (!insertError.message.includes("uuid")) {
                console.log("✅ Probable Success: Error was NOT about UUID types.");
            }
        }
    } else {
        console.log("✅ Insert Success! (RLS policies might be too open, but Type is Fixed)");
        // Cleanup if it actually worked
        await supabase.from('profiles').delete().eq('id', testId);
    }
}

verifyFix();
