const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function verify() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    try {
        const leagueId = '723e9c26-f5fc-4e5a-a705-bbe046dabdd1';
        const currentUserId = 'user_38GKAWlAxWgwMuoirhNpUxHRwWM';
        
        console.log('--- Checking league_players visibility ---');
        // Simulate Authenticated Role and the current user's ID
        await client.query('BEGIN');
        await client.query(`SET LOCAL "request.jwt.claim.sub" = '${currentUserId}'`);
        await client.query(`SET LOCAL "role" = 'authenticated'`);
        
        const lpRes = await client.query('SELECT count(*) FROM public.league_players WHERE league_id = $1', [leagueId]);
        console.log(`Visible league_players in league ${leagueId}: ${lpRes.rows[0].count} (Expected: 12)`);
        
        console.log('\n--- Checking profile visibility ---');
        // Test Dummy Player 9 (has not played matches)
        const dummy9Id = '0439bbd0-8cc8-41ba-bd8a-0537b112e18b';
        const profRes = await client.query('SELECT full_name FROM public.profiles WHERE id = $1', [dummy9Id]);
        
        if (profRes.rows.length > 0) {
            console.log(`SUCCESS: Profile for ${dummy9Id} (${profRes.rows[0].full_name}) is now VISIBLE to ${currentUserId}.`);
        } else {
            console.log(`FAILURE: Profile for ${dummy9Id} is still HIDDEN.`);
        }
        
        // Final check on another dummy 7
        const dummy7Id = '22d588b5-9413-4c80-a340-274d55bf84f0';
        const prof7Res = await client.query('SELECT full_name FROM public.profiles WHERE id = $1', [dummy7Id]);
        console.log(`Target Dummy 7 (${dummy7Id}) Visibility: ${prof7Res.rows.length > 0 ? 'TRUE' : 'FALSE'}`);

        await client.query('ROLLBACK');

    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        await client.end();
    }
}
verify();
