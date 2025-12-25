const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // IDs found previously
        const leagueIds = [
            '059f7d6b-bbc3-44d6-8228-667e7145ce2c',
            '51362209-a460-4e26-884f-283021d45317'
        ];

        for (const id of leagueIds) {
            console.log(`Resetting schedule for league ${id}...`);
            // Delete reschedule requests first
            await client.query("DELETE FROM reschedule_requests WHERE match_id IN (SELECT id FROM matches WHERE league_id = $1)", [id]);
            // Delete games first
            await client.query("DELETE FROM games WHERE match_id IN (SELECT id FROM matches WHERE league_id = $1)", [id]);
            // Delete matches
            await client.query("DELETE FROM matches WHERE league_id = $1", [id]);
            // Reset status to setup
            await client.query("UPDATE leagues SET status = 'setup' WHERE id = $1", [id]);
            console.log(`Reset complete for ${id}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
