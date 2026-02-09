const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function createDummyPlayersAndJoinLeague() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    try {
        await client.connect();

        // Find the league
        const leagueRes = await client.query("SELECT id FROM leagues WHERE name = 'Test Session'");
        if (leagueRes.rows.length === 0) {
            console.error("League 'Test Session' not found.");
            process.exit(1);
        }
        const leagueId = leagueRes.rows[0].id;
        console.log(`Found league 'Test Session' with ID: ${leagueId}`);

        // Create 7 dummy players
        for (let i = 1; i <= 7; i++) {
            const playerId = `dummy_${i}`;
            const fullName = `Dummy ${i}`;
            const email = `dummy${i}@example.com`;

            // Insert into profiles
            const profileQuery = `
                INSERT INTO public.profiles (id, role, full_name, email)
                VALUES ($1, 'player', $2, $3)
                ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email
                RETURNING id;
            `;
            await client.query(profileQuery, [playerId, fullName, email]);
            console.log(`Created/Updated profile for ${fullName}`);

            // Join league
            const joinQuery = `
                INSERT INTO public.league_players (league_id, player_id, status)
                VALUES ($1, $2, 'active')
                ON CONFLICT (league_id, player_id) DO NOTHING;
            `;
            await client.query(joinQuery, [leagueId, playerId]);
            console.log(`Added ${fullName} to league`);
        }

        console.log("Successfully added 7 dummy players to 'Test Session'.");

    } catch (err) {
        console.error("Error creating dummy players:", err);
    } finally {
        await client.end();
    }
}

createDummyPlayersAndJoinLeague();
