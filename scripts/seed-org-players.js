const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.local' });

const OPERATOR_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9'; // The current operator

async function runPg() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Get League Org ID
        const leagueRes = await client.query(
            "SELECT id FROM leagues WHERE operator_id = $1 AND type = 'league'",
            [OPERATOR_ID]
        );

        if (leagueRes.rows.length === 0) {
            console.error("No League Organization found for this operator.");
            return;
        }

        const leagueId = leagueRes.rows[0].id;
        console.log(`Seeding players for League Org: ${leagueId}`);

        // 2. Create 25 Dummy Users (Profiles) and Add to League
        for (let i = 1; i <= 25; i++) {
            const userId = `dummy_user_${uuidv4().substring(0, 8)}`;
            const email = `player${i}@example.com`;
            const fullName = `Player ${i}`;

            // Insert Profile
            await client.query(
                `INSERT INTO profiles (id, email, full_name, role) 
                 VALUES ($1, $2, $3, 'player') 
                 ON CONFLICT (id) DO NOTHING`,
                [userId, email, fullName]
            );

            // Insert into League Players (Org Level)
            await client.query(
                `INSERT INTO league_players (league_id, player_id, status) 
                 VALUES ($1, $2, 'active') 
                 ON CONFLICT (league_id, player_id) DO NOTHING`,
                [leagueId, userId]
            );
        }

        console.log("Successfully seeded 25 players.");

    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

runPg();
