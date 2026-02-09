require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function cleanup() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Identify the session ID from the match we were testing
        const testMatchId = '94e22009-210b-4713-991e-89322f3a1dbd';
        const matchRes = await client.query("SELECT league_id FROM matches WHERE id = $1", [testMatchId]);

        if (matchRes.rows.length === 0) {
            console.log("No test match found. Checking for 'Test Session' name...");
            const sessRes = await client.query("SELECT id, name FROM leagues WHERE name ILIKE '%Test%' OR name ILIKE '%Spring 2026%'");
            console.log("Found sessions:", sessRes.rows);
            return;
        }

        const sessionId = matchRes.rows[0].league_id;
        const sessionNameRes = await client.query("SELECT name FROM leagues WHERE id = $1", [sessionId]);
        const sessionName = sessionNameRes.rows[0]?.name || "Unknown";

        console.log(`Cleaning up session: ${sessionName} (${sessionId})`);

        // 2. Clear dismissals first (foreign key to match)
        await client.query("DELETE FROM dismissed_reminders WHERE match_id IN (SELECT id FROM matches WHERE league_id = $1)", [sessionId]);

        // 3. Delete games (foreign key to match)
        await client.query("DELETE FROM games WHERE match_id IN (SELECT id FROM matches WHERE league_id = $1)", [sessionId]);

        // 4. Delete matches
        const delMatches = await client.query("DELETE FROM matches WHERE league_id = $1", [sessionId]);
        console.log(`Deleted ${delMatches.rowCount} matches.`);

        // 5. Delete league_players (membership)
        const delMembers = await client.query("DELETE FROM league_players WHERE league_id = $1", [sessionId]);
        console.log(`Removed ${delMembers.rowCount} players from session.`);

        // 6. Delete team_members (if any)
        await client.query("DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE league_id = $1)", [sessionId]);
        await client.query("DELETE FROM teams WHERE league_id = $1", [sessionId]);

        // 7. Delete the session itself
        await client.query("DELETE FROM leagues WHERE id = $1", [sessionId]);
        console.log(`Deleted session ${sessionName}.`);

    } catch (err) {
        console.error('Cleanup Error:', err);
    } finally {
        await client.end();
    }
}

cleanup();
