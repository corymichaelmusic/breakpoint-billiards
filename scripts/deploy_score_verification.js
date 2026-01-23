/**
 * Deploy Score Verification System
 * 
 * This script deploys the database schema and RPC functions needed for
 * dual-device score verification.
 * 
 * Run with: node scripts/deploy_score_verification.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deploySql(filename, description) {
    console.log(`\n📦 Deploying: ${description}...`);
    const sqlPath = path.join(__dirname, '..', 'supabase', filename);

    if (!fs.existsSync(sqlPath)) {
        console.error(`   ❌ File not found: ${sqlPath}`);
        return false;
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(async () => {
        // Fallback: Try direct SQL execution via REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql_query: sql })
        });

        if (!response.ok) {
            // Try using the Supabase SQL editor endpoint
            return { error: await response.text() };
        }
        return { error: null };
    });

    if (error) {
        console.error(`   ❌ Error: ${error}`);
        console.log('   ⚠️  You may need to run this SQL manually in the Supabase SQL Editor.');
        console.log(`   📄 File: ${sqlPath}`);
        return false;
    }

    console.log(`   ✅ ${description} deployed successfully`);
    return true;
}

async function main() {
    console.log("===============================================");
    console.log("  Score Verification System Deployment");
    console.log("===============================================");

    console.log("\n📋 Deployment Plan:");
    console.log("   1. Schema migration (verification columns)");
    console.log("   2. Submit for verification RPC");
    console.log("   3. Auto-submit verification function");

    // Note: Direct SQL execution requires special setup in Supabase
    // The recommended approach is to run these in the SQL Editor
    console.log("\n⚠️  IMPORTANT: For security reasons, you may need to run these");
    console.log("   SQL files manually in the Supabase SQL Editor:");
    console.log("");
    console.log("   1. supabase/score_verification_schema.sql");
    console.log("   2. supabase/submit_match_for_verification.sql");
    console.log("   3. supabase/auto_submit_verification.sql");
    console.log("");
    console.log("   Navigate to: https://supabase.com/dashboard/project/[your-project]/sql");
    console.log("");

    // Output the SQL files for easy copy-paste
    console.log("===============================================");
    console.log("  SQL Files to Execute");
    console.log("===============================================\n");

    const files = [
        'score_verification_schema.sql',
        'submit_match_for_verification.sql',
        'auto_submit_verification.sql'
    ];

    for (const file of files) {
        const filePath = path.join(__dirname, '..', 'supabase', file);
        if (fs.existsSync(filePath)) {
            console.log(`\n--- ${file} ---`);
            console.log(`Path: ${filePath}`);
            console.log(`Size: ${fs.statSync(filePath).size} bytes`);
        }
    }

    console.log("\n✅ SQL files are ready. Please execute them in order.");
}

main().catch(console.error);
