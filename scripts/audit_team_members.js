const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    try {
        // 1. Check column types for team_members
        const colRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'team_members'");
        console.log('=== team_members columns ===');
        colRes.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
        
        // 2. Check ALL RLS policies for team_members
        const polRes = await client.query("SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'team_members'");
        console.log('\n=== team_members RLS policies ===');
        polRes.rows.forEach(p => console.log(`  ${p.policyname} (${p.cmd}): ${p.qual}`));

        // 3. Check for triggers
        const triggerRes = await client.query("SELECT tgname FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'team_members' AND tgisinternal = false");
        console.log('\n=== team_members triggers ===');
        triggerRes.rows.forEach(t => console.log(`  ${t.tgname}`));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}
check();
