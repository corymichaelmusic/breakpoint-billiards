const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const OPERATOR_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function runPg() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Get League Org ID
        const leagueRes = await client.query(
            "SELECT id, name FROM leagues WHERE operator_id = $1 AND type = 'league'",
            [OPERATOR_ID]
        );

        if (leagueRes.rows.length === 0) {
            console.log("No League Organization found.");
            return;
        }

        const leagueId = leagueRes.rows[0].id;
        console.log(`League Org ID: ${leagueId} (${leagueRes.rows[0].name})`);

        // 2. Count players in this league
        const countRes = await client.query(
            "SELECT count(*) FROM league_players WHERE league_id = $1",
            [leagueId]
        );
        console.log(`Players in League Org: ${countRes.rows[0].count}`);

        // 3. Show a few
        const playersRes = await client.query(
            "SELECT * FROM league_players WHERE league_id = $1 LIMIT 5",
            [leagueId]
        );
        console.table(playersRes.rows);

        // 4. Check RLS Policies
        console.log("--- RLS POLICIES for league_players ---");
        const policyRes = await client.query("select * from pg_policies where tablename = 'league_players'");
        console.table(policyRes.rows);

    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

runPg();
