const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    try {
        const leagueId = '723e9c26-f5fc-4e5a-a705-bbe046dabdd1';
        const currentUserId = 'user_38GKAWlAxWgwMuoirhNpUxHRwWM'; // The user's ID
        
        // 1. Get available player IDs
        const lps = await client.query('SELECT player_id FROM league_players WHERE league_id = $1', [leagueId]);
        const teamRes = await client.query('SELECT id FROM teams WHERE league_id = $1', [leagueId]);
        const teamIds = teamRes.rows.map(r => r.id);
        const takenRes = await client.query('SELECT player_id FROM team_members WHERE team_id = ANY($1)', [teamIds]);
        const takenIds = takenRes.rows.map(r => r.player_id);
        const availIds = lps.rows.filter(r => !takenIds.includes(r.player_id)).map(r => r.player_id);
        
        console.log('Available Player IDs:', availIds);
        
        // 2. Test share_any_league logic manually
        // We'll simulate what the function does since we can't easily set the JWT in a direct pg client session
        console.log('\nTesting visibility logic for available players (simulating share_any_league):');
        for (const targetId of availIds) {
            const shareRes = await client.query(`
                SELECT EXISTS (
                    SELECT 1 FROM public.league_players lp1
                    JOIN public.league_players lp2 ON lp1.league_id = lp2.league_id
                    WHERE lp1.player_id = $1
                    AND lp2.player_id = $2
                ) as share
            `, [targetId, currentUserId]);
            console.log(`  Target ${targetId}: Visibility Share = ${shareRes.rows[0].share}`);
        }

        // 3. Verify the policy logic
        const testTarget = availIds[0];
        console.log(`\nVerifying RLS criteria for Target ${testTarget}:`);
        const playedRes = await client.query("SELECT check_has_played($1) as played", [testTarget]);
        console.log(`  check_has_played: ${playedRes.rows[0].played}`);
        console.log(`  is_own_id: ${testTarget === currentUserId}`);
        
        const shareRes = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM public.league_players lp1
                JOIN public.league_players lp2 ON lp1.league_id = lp2.league_id
                WHERE lp1.player_id = $1
                AND lp2.player_id = $2
            ) as share
        `, [testTarget, currentUserId]);
        console.log(`  share_any_league simulation: ${shareRes.rows[0].share}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}
check();
