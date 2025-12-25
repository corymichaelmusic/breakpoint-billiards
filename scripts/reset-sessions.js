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

        // Delete sessions (type = 'session') for this operator
        // We also need to delete related league_players and matches/games first due to FKs
        // But our deleteLeague action handles this. 
        // For a quick script, we'll just cascade delete manually or use the action logic.
        // Let's just delete from leagues where type='session' and operator_id=...
        // We need to delete children first.

        console.log("Deleting sessions for operator:", OPERATOR_ID);

        // 1. Get Session IDs
        const res = await client.query("SELECT id FROM leagues WHERE operator_id = $1 AND type = 'session'", [OPERATOR_ID]);
        const sessionIds = res.rows.map(r => r.id);

        if (sessionIds.length === 0) {
            console.log("No sessions found.");
            return;
        }

        console.log("Found sessions:", sessionIds);

        // 2. Delete League Players for these sessions
        await client.query("DELETE FROM league_players WHERE league_id = ANY($1)", [sessionIds]);

        // 3. Delete Matches for these sessions
        // First delete games
        const matchRes = await client.query("SELECT id FROM matches WHERE league_id = ANY($1)", [sessionIds]);
        const matchIds = matchRes.rows.map(r => r.id);
        if (matchIds.length > 0) {
            await client.query("DELETE FROM games WHERE match_id = ANY($1)", [matchIds]);
        }
        await client.query("DELETE FROM matches WHERE league_id = ANY($1)", [sessionIds]);

        // 4. Delete the Sessions
        await client.query("DELETE FROM leagues WHERE id = ANY($1)", [sessionIds]);

        console.log("Successfully deleted sessions.");

    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

runPg();
