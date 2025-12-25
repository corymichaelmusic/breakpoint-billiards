const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.local' });

const OPERATOR_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';
const WEEKS_TO_SIMULATE = 14;

async function runSimulation() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to DB");

        // 1. Get all sessions for this operator
        // We need to find leagues where the parent league is owned by the operator
        // Or just find all sessions linked to the operator's leagues
        const sessionsRes = await client.query(`
            SELECT s.id, s.name, s.parent_league_id 
            FROM leagues s
            JOIN leagues p ON s.parent_league_id = p.id
            WHERE p.operator_id = $1 AND s.type = 'session'
        `, [OPERATOR_ID]);

        const sessions = sessionsRes.rows;
        console.log(`Found ${sessions.length} sessions to simulate.`);

        for (const session of sessions) {
            console.log(`\nProcessing Session: ${session.name} (${session.id})`);

            // 2. Clear existing matches for this session
            // Need to delete games first due to FK constraint
            await client.query(`
                DELETE FROM games 
                WHERE match_id IN (SELECT id FROM matches WHERE league_id = $1)
            `, [session.id]);
            await client.query("DELETE FROM matches WHERE league_id = $1", [session.id]);

            // Update status to active
            await client.query("UPDATE leagues SET status = 'active' WHERE id = $1", [session.id]);
            console.log("  Cleared existing matches and set status to active.");

            // 3. Get Players
            const playersRes = await client.query(
                "SELECT player_id FROM league_players WHERE league_id = $1",
                [session.id]
            );
            const playerIds = playersRes.rows.map(r => r.player_id);

            if (playerIds.length < 2) {
                console.log("  Not enough players to simulate.");
                continue;
            }

            // 4. Generate & Play 14 Weeks
            console.log(`  Simulating ${WEEKS_TO_SIMULATE} weeks for ${playerIds.length} players...`);

            let matchCount = 0;

            for (let week = 1; week <= WEEKS_TO_SIMULATE; week++) {
                // Simple pairing logic: Shuffle and pair
                // In a real app, we'd use a proper round-robin algorithm, but for simulation random pairing is fine
                // provided we rotate enough.
                const shuffled = [...playerIds].sort(() => 0.5 - Math.random());
                const pairs = [];
                for (let i = 0; i < shuffled.length; i += 2) {
                    if (i + 1 < shuffled.length) {
                        pairs.push([shuffled[i], shuffled[i + 1]]);
                    }
                }

                for (const [p1, p2] of pairs) {
                    await simulateMatch(client, session.id, p1, p2, week);
                    matchCount++;
                }
            }
            console.log(`  Simulated ${matchCount} matches.`);
        }

    } catch (err) {
        console.error("Simulation Error:", err);
    } finally {
        await client.end();
    }
}

async function simulateMatch(client, sessionId, p1, p2, week) {
    const matchId = uuidv4();

    // Randomize Winner
    const p1Wins = Math.random() > 0.5;
    const winnerId = p1Wins ? p1 : p2;

    // Randomize Scores (Race to 5)
    // Winner gets 10 points (in our simplified logic for now, or calculated)
    const winnerScore = 10;
    const loserScore = Math.floor(Math.random() * 8); // 0 to 7

    // Assign scores for 8-ball and 9-ball separately for rich data
    const score8BallP1 = p1Wins ? winnerScore : loserScore;
    const score8BallP2 = p1Wins ? loserScore : winnerScore;

    // Maybe flip winner for 9-ball occasionally? Nah, keep it simple.
    const score9BallP1 = p1Wins ? winnerScore : loserScore;
    const score9BallP2 = p1Wins ? loserScore : winnerScore;

    const totalP1 = score8BallP1 + score9BallP1;
    const totalP2 = score8BallP2 + score9BallP2;

    // Insert Match
    await client.query(
        `INSERT INTO matches (
            id, league_id, player1_id, player2_id, week_number, 
            status, created_at, race_to_p1, race_to_p2, 
            current_points_p1, current_points_p2, winner_id,
            payment_status_p1, payment_status_p2,
            status_8ball, status_9ball,
            points_8ball_p1, points_8ball_p2,
            points_9ball_p1, points_9ball_p2
        ) VALUES ($1, $2, $3, $4, $5, 'finalized', NOW(), 5, 5, $6, $7, $8, 'paid_cash', 'paid_cash', 'finalized', 'finalized', $9, $10, $11, $12)`,
        [matchId, sessionId, p1, p2, week, totalP1, totalP2, winnerId, score8BallP1, score8BallP2, score9BallP1, score9BallP2]
    );

    // Insert Games (One for 8-ball, one for 9-ball)
    await client.query(
        `INSERT INTO games (
            match_id, game_number, score_p1, score_p2, submitted_by, verified_at, game_type
        ) VALUES ($1, 1, $2, $3, $4, NOW(), '8ball')`,
        [matchId, score8BallP1, score8BallP2, winnerId]
    );
    await client.query(
        `INSERT INTO games (
            match_id, game_number, score_p1, score_p2, submitted_by, verified_at, game_type
        ) VALUES ($1, 2, $2, $3, $4, NOW(), '9ball')`,
        [matchId, score9BallP1, score9BallP2, winnerId]
    );
}

runSimulation();
