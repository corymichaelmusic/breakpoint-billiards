const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    // Check ALL policies on league_players
    const lp_policies = await client.query("SELECT policyname, cmd, permissive, qual FROM pg_policies WHERE tablename = 'league_players' ORDER BY policyname");
    console.log('=== league_players policies ===');
    lp_policies.rows.forEach(p => console.log(`  ${p.policyname} (${p.cmd}, ${p.permissive}): ${p.qual?.substring(0, 200)}`));
    
    // Check profiles policies  
    const prof_policies = await client.query("SELECT policyname, cmd, permissive, qual FROM pg_policies WHERE tablename = 'profiles' ORDER BY policyname");
    console.log('\n=== profiles policies ===');
    prof_policies.rows.forEach(p => console.log(`  ${p.policyname} (${p.cmd}, ${p.permissive}): ${p.qual?.substring(0, 200)}`));

    // Check teams policies
    const team_policies = await client.query("SELECT policyname, cmd, permissive, qual FROM pg_policies WHERE tablename = 'teams' ORDER BY policyname");
    console.log('\n=== teams policies ===');
    team_policies.rows.forEach(p => console.log(`  ${p.policyname} (${p.cmd}, ${p.permissive}): ${p.qual?.substring(0, 200)}`));

    // Check team_members policies
    const tm_policies = await client.query("SELECT policyname, cmd, permissive, qual FROM pg_policies WHERE tablename = 'team_members' ORDER BY policyname");
    console.log('\n=== team_members policies ===');
    tm_policies.rows.forEach(p => console.log(`  ${p.policyname} (${p.cmd}, ${p.permissive}): ${p.qual?.substring(0, 200)}`));

    // Check if RLS is enabled
    const rls = await client.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('league_players', 'profiles', 'teams', 'team_members')");
    console.log('\n=== RLS enabled ===');
    rls.rows.forEach(r => console.log(`  ${r.relname}: ${r.relrowsecurity}`));

    await client.end();
}
check();
