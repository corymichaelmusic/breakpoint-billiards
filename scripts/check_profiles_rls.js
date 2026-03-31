const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    try {
        const leagueId = '723e9c26-f5fc-4e5a-a705-bbe046dabdd1';
        
        // 1. Get available player IDs
        const lps = await client.query('SELECT player_id FROM league_players WHERE league_id = $1', [leagueId]);
        const teamRes = await client.query('SELECT id FROM teams WHERE league_id = $1', [leagueId]);
        const teamIds = teamRes.rows.map(r => r.id);
        const takenRes = await client.query('SELECT player_id FROM team_members WHERE team_id = ANY($1)', [teamIds]);
        const takenIds = takenRes.rows.map(r => r.player_id);
        const availIds = lps.rows.filter(r => !takenIds.includes(r.player_id)).map(r => r.player_id);
        
        console.log('Available Player IDs:', availIds);
        
        // 2. Check their profile data
        if (availIds.length > 0) {
            const profs = await client.query('SELECT id, full_name, is_active FROM profiles WHERE id = ANY($1)', [availIds]);
            console.log('\nProfiles status:');
            availIds.forEach(id => {
                const p = profs.rows.find(row => row.id === id);
                if (p) {
                    console.log(`  ${id}: Found (${p.full_name}, is_active=${p.is_active})`);
                } else {
                    console.log(`  ${id}: NOT FOUND`);
                }
            });
        }
        
        // 3. Check check_has_played function
        const funcRes = await client.query("SELECT pg_get_functiondef(p.oid) as def FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'check_has_played'");
        console.log('\ncheck_has_played definition:', funcRes.rows[0]?.def);

        // 4. Test the function for an available player
        if (availIds.length > 0) {
            const testRes = await client.query("SELECT check_has_played($1) as played", [availIds[0]]);
            console.log(`\nTest check_has_played(${availIds[0]}):`, testRes.rows[0]?.played);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}
check();
