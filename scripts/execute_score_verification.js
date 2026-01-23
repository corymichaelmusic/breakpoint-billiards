/**
 * Execute Score Verification SQL Migrations using pg library
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function runPg() {
    console.log('===============================================');
    console.log('  Score Verification Database Deployment');
    console.log('===============================================\n');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL not found in .env.local');
        process.exit(1);
    }

    console.log('🔗 Connecting to database...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const files = [
        'score_verification_schema.sql',
        'submit_match_for_verification.sql',
        'auto_submit_verification.sql'
    ];

    try {
        await client.connect();
        console.log('✅ Connected!\n');

        for (const file of files) {
            const sqlPath = path.join(__dirname, '../supabase', file);
            console.log(`📦 Executing: ${file}...`);

            if (!fs.existsSync(sqlPath)) {
                console.error(`   ❌ File not found: ${sqlPath}`);
                continue;
            }

            const sql = fs.readFileSync(sqlPath, 'utf8');
            await client.query(sql);
            console.log(`   ✅ ${file} executed successfully`);
        }

        console.log('\n===============================================');
        console.log('  All migrations completed successfully! 🎉');
        console.log('===============================================');

    } catch (err) {
        console.error('\n❌ PG Error:', err.message);
        if (err.detail) console.error('   Detail:', err.detail);
        if (err.hint) console.error('   Hint:', err.hint);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runPg();
