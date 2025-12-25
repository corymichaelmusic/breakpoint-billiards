const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.local' });

const OPERATOR_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

async function runSimulation() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to DB");

        // --- PART 1: EXISTING LEAGUE ---
        console.log("\n--- Processing Existing League ---");
        const existingLeagueRes = await client.query(
            "SELECT id, name FROM leagues WHERE operator_id = $1 AND type = 'league' LIMIT 1",
            [OPERATOR_ID]
        );

        if (existingLeagueRes.rows.length === 0) {
            console.error("No existing league found!");
            return;
        }

        const existingLeagueId = existingLeagueRes.rows[0].id;
        console.log(`Found League: ${existingLeagueRes.rows[0].name} (${existingLeagueId})`);

        // Get existing players
        const existingPlayersRes = await client.query(
            "SELECT player_id FROM league_players WHERE league_id = $1",
            [existingLeagueId]
        );
        const existingPlayerIds = existingPlayersRes.rows.map(r => r.player_id);
        console.log(`Found ${existingPlayerIds.length} existing players.`);

        // Create 3 Sessions
        const existingSessions = ['Spring 2025', 'Summer 2025', 'Fall 2025'];
        for (const sessionName of existingSessions) {
            await createSessionAndSchedule(client, existingLeagueId, sessionName, existingPlayerIds, OPERATOR_ID);
        }

        // --- PART 2: NEW LEAGUE ---
        console.log("\n--- Creating New League ---");
        const newLeagueId = uuidv4();
        const newLeagueName = "Metro Pool League";

        await client.query(
            "INSERT INTO leagues (id, name, operator_id, status, type, created_at) VALUES ($1, $2, $3, 'active', 'league', NOW())",
            [newLeagueId, newLeagueName, OPERATOR_ID]
        );
        console.log(`Created New League: ${newLeagueName} (${newLeagueId})`);

        // Seed 36 Players
        const newPlayerIds = [];
        for (let i = 1; i <= 36; i++) {
            const playerId = `sim_user_${uuidv4().split('-')[0]}`;
            const email = `sim_player_${i}@example.com`;
            const name = `Sim Player ${i}`;

            // Create Profile
            await client.query(
                "INSERT INTO profiles (id, email, full_name, role, fargo_rating) VALUES ($1, $2, $3, 'player', 500) ON CONFLICT (id) DO NOTHING",
                [playerId, email, name]
            );

            // Add to League Org
            await client.query(
                "INSERT INTO league_players (league_id, player_id, status, payment_status) VALUES ($1, $2, 'active', 'paid')",
                [newLeagueId, playerId]
            );

            newPlayerIds.push(playerId);
        }
        console.log(`Seeded 36 players for ${newLeagueName}`);

        // Create 3 Sessions for New League
        const newSessions = ['Winter 2025', 'Spring 2026', 'Summer 2026'];
        for (const sessionName of newSessions) {
            await createSessionAndSchedule(client, newLeagueId, sessionName, newPlayerIds, OPERATOR_ID);
        }

    } catch (err) {
        console.error("Simulation Error:", err);
    } finally {
        await client.end();
    }
}

async function createSessionAndSchedule(client, parentId, name, playerIds, operatorId) {
    const sessionId = uuidv4();
    console.log(`  Creating Session: ${name}...`);

    // 1. Create Session
    await client.query(
        "INSERT INTO leagues (id, name, operator_id, status, type, parent_league_id, creation_fee_status, created_at) VALUES ($1, $2, $3, 'setup', 'session', $4, 'paid', NOW())",
        [sessionId, name, operatorId, parentId]
    );

    // 2. Add Players (All of them for simplicity, or random subset)
    // Let's add ALL players to the session for maximum data density
    for (const pid of playerIds) {
        await client.query(
            "INSERT INTO league_players (league_id, player_id, status, payment_status) VALUES ($1, $2, 'active', 'paid')",
            [sessionId, pid]
        );
    }

    // 3. Generate Schedule (Simple Round Robin - 1 Week)
    // Just generating 1 week of matches to prove it works and populate the dashboard
    console.log(`    Generating schedule for ${playerIds.length} players...`);

    // Shuffle players
    const shuffled = [...playerIds].sort(() => 0.5 - Math.random());
    const matches = [];

    // Create pairs
    for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
            matches.push([shuffled[i], shuffled[i + 1]]);
        }
    }

    for (const [p1, p2] of matches) {
        const matchId = uuidv4();
        await client.query(
            `INSERT INTO matches (
                id, league_id, player1_id, player2_id, week_number, 
                status, created_at, race_to_p1, race_to_p2, 
                payment_status_p1, payment_status_p2
            ) VALUES ($1, $2, $3, $4, 1, 'scheduled', NOW(), 5, 5, 'unpaid', 'unpaid')`,
            [matchId, sessionId, p1, p2]
        );
    }

    console.log(`    Created ${matches.length} matches for Week 1.`);
}

runSimulation();
