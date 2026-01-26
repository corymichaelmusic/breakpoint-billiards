/**
 * Migration: Deploy Secure BBRS Functions
 * This moves the proprietary BBRS algorithm server-side
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function runMigration() {
    console.log("=== Deploying Secure BBRS Functions ===\n");

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("✓ Connected to database\n");

        // 1. Deploy calculate_bbrs_delta function
        console.log("1. Creating calculate_bbrs_delta function...");
        const bbrsCalcSQL = fs.readFileSync(
            path.join(__dirname, '..', 'supabase', 'calculate_bbrs_delta.sql'),
            'utf8'
        );
        await client.query(bbrsCalcSQL);
        console.log("   ✓ calculate_bbrs_delta created\n");

        // 1.5 Deploy get_race_target function (Dependency)
        console.log("1.5 Creating get_race_target function...");
        const raceTargetSQL = fs.readFileSync(
            path.join(__dirname, '..', 'supabase', 'get_race_target.sql'),
            'utf8'
        );
        await client.query(raceTargetSQL);
        console.log("   ✓ get_race_target created\n");

        // 2. Deploy updated finalize_match_stats_v2 function
        console.log("2. Updating finalize_match_stats_v2 function...");
        const finalizeSQL = fs.readFileSync(
            path.join(__dirname, '..', 'supabase', 'finalize_match_stats_v2.sql'),
            'utf8'
        );
        await client.query(finalizeSQL);
        console.log("   ✓ finalize_match_stats_v2 updated\n");

        // 3. Force schema cache reload
        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log("✓ Schema cache reloaded\n");

        console.log("=== Migration Complete ===");
        console.log("BBRS algorithm is now SERVER-SIDE ONLY.");
        console.log("The mobile app can no longer see the formula!\n");

    } catch (e) {
        console.error("✗ Migration failed:", e);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
