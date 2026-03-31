const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function verifyRecursion() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    try {
        const currentUserId = 'user_38GKAWlAxWgwMuoirhNpUxHRwWM';
        
        console.log('--- Simulating Session Fetch (checking for recursion) ---');
        await client.query('BEGIN');
        await client.query(`SET LOCAL "request.jwt.claim.sub" = '${currentUserId}'`);
        await client.query(`SET LOCAL "role" = 'authenticated'`);
        
        // Simulating the query from SessionContext.tsx (select * from leagues)
        const lRes = await client.query('SELECT count(*) FROM public.leagues');
        console.log(`Leagues visible: ${lRes.rows[0].count}`);
        
        // Simulating a join to profiles/league_players
        const profRes = await client.query('SELECT count(*) FROM public.profiles WHERE is_active = true');
        console.log(`Profiles visible: ${profRes.rows[0].count}`);

        await client.query('ROLLBACK');
        console.log('--- RECURSION CHECK COMPLETE: NO ERRORS DETECTED ---');

    } catch (err) {
        console.error('Error during recursion check:', err);
    } finally {
        await client.end();
    }
}
verifyRecursion();
