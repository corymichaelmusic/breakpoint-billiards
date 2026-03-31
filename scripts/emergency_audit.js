const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function audit() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    console.log('--- LEAGUES POLICIES ---');
    const lRes = await client.query("SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'leagues'");
    lRes.rows.forEach(r => console.log(`  ${r.policyname} (${r.cmd}): ${r.qual}`));

    console.log('\n--- LEAGUE_PLAYERS POLICIES ---');
    const lpRes = await client.query("SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'league_players'");
    lpRes.rows.forEach(r => console.log(`  ${r.policyname} (${r.cmd}): ${r.qual}`));

    console.log('\n--- PROFILES POLICIES ---');
    const pRes = await client.query("SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles'");
    pRes.rows.forEach(r => console.log(`  ${r.policyname} (${r.cmd}): ${r.qual}`));

    await client.end();
}
audit();
