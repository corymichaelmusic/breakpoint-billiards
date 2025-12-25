const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';
const LEAGUE_ID = 'ad10328d-822b-4cc5-80ec-1cec4e3e373e'; // Breakpoint Billiards Money Monday

async function testRLS() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        // Start transaction
        await client.query('BEGIN');

        // Simulate Auth
        // Note: Supabase uses request.jwt.claim.sub for auth.uid()
        await client.query(`SELECT set_config('request.jwt.claim.sub', '${USER_ID}', true)`);
        await client.query(`SET ROLE authenticated`);

        const jwtRes = await client.query("select current_setting('request.jwt.claim.sub', true) as sub");
        console.log("Current Setting Sub:", jwtRes.rows[0]?.sub);

        console.log(`Simulating User: ${USER_ID}`);
        console.log(`Querying players for League: ${LEAGUE_ID}`);

        // Run the query that the page runs
        const res = await client.query(`
            SELECT lp.player_id, p.full_name
            FROM league_players lp
            LEFT JOIN profiles p ON lp.player_id = p.id
            WHERE lp.league_id = '${LEAGUE_ID}'
        `);

        console.log(`Rows returned: ${res.rowCount}`);
        if (res.rowCount > 0) {
            console.table(res.rows.slice(0, 5)); // Show first 5
        } else {
            console.log("No rows returned. RLS is likely blocking access.");
        }

        // Check if I can see the league itself
        const leagueRes = await client.query(`
            SELECT id, name, operator_id 
            FROM leagues 
            WHERE id = '${LEAGUE_ID}'
        `);
        console.log("League visibility:", leagueRes.rows);

        await client.query('ROLLBACK');

    } catch (err) {
        console.error("Error testing RLS:", err);
    } finally {
        await client.end();
    }
}

testRLS();
