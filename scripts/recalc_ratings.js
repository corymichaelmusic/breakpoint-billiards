const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Copy of logic from utils/rating.ts
function calculateEloChange(playerRating, opponentRating, isWin) {
    const K_WIN = 30;
    const K_LOSS = 15;
    const K = isWin ? K_WIN : K_LOSS;

    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = isWin ? 1 : 0;

    return Math.round(K * (actualScore - expectedScore));
}

// Map Fargo Rating to Breakpoint Level (1-10) - Just for logging
function getBreakpointLevel(rating) {
    let level = 1;
    if (rating < 200) { level = 1.0; }
    else if (rating < 300) { level = 2 + (rating - 200) / 100; }
    else if (rating < 400) { level = 3 + (rating - 300) / 100; }
    else if (rating < 500) { level = 4 + (rating - 400) / 100; }
    else if (rating < 550) { level = 5 + (rating - 500) / 50; }
    else if (rating < 600) { level = 6 + (rating - 550) / 50; }
    else if (rating < 650) { level = 7 + (rating - 600) / 50; }
    else if (rating < 700) { level = 8 + (rating - 650) / 50; }
    else if (rating < 800) { level = 9 + (rating - 700) / 100; }
    else { level = 10 + (rating - 800) / 100; }
    return Math.round(level * 10) / 10;
}

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();

        console.log("Starting Rating Recalculation...");

        // 1. Reset all players to 500
        console.log("Resetting all players to 500...");
        await client.query(`UPDATE profiles SET fargo_rating = 500`);

        // 2. Fetch all FINALIZED matches, ordered by scheduled_date or created_at
        // We need points to determine winner if winner_id columns are null (legacy data?)
        // But logic should rely on points generally if winner_id missing.
        console.log("Fetching finalized matches...");
        const res = await client.query(`
            SELECT 
                id, 
                player1_id, 
                player2_id, 
                score_8ball_p1, score_8ball_p2, 
                score_9ball_p1, score_9ball_p2,
                points_8ball_p1, points_8ball_p2,
                points_9ball_p1, points_9ball_p2,
                status_8ball, status_9ball,
                scheduled_date, created_at
            FROM matches 
            WHERE status = 'finalized'
            ORDER BY scheduled_date ASC, created_at ASC
        `);

        const matches = res.rows;
        console.log(`Found ${matches.length} finalized matches.`);

        // In-memory map of ratings to avoid constant DB reads/writes during loop
        const ratings = {};

        // Helper to get rating
        const getRating = (id) => ratings[id] !== undefined ? ratings[id] : 500;

        for (const m of matches) {
            const p1 = m.player1_id;
            const p2 = m.player2_id;
            let r1 = getRating(p1);
            let r2 = getRating(p2);

            // Determine Points (prefer points_ columns, fallback to score_ columns? No, points_ is the new standard)
            // Actually, we should check if 8-ball and 9-ball were played.
            const p1Pts8 = m.points_8ball_p1 || 0;
            const p2Pts8 = m.points_8ball_p2 || 0;
            const p1Pts9 = m.points_9ball_p1 || 0;
            const p2Pts9 = m.points_9ball_p2 || 0;

            // 8-Ball Processing
            if (p1Pts8 > 0 || p2Pts8 > 0) { // If played
                // Check winner
                if (p1Pts8 !== p2Pts8) {
                    const isP1Win = p1Pts8 > p2Pts8;
                    const delta1 = calculateEloChange(r1, r2, isP1Win);
                    const delta2 = calculateEloChange(r2, r1, !isP1Win);

                    r1 += delta1;
                    r2 += delta2;
                    // console.log(`Match ${m.id} (8-Ball): P1(${r1-delta1}->${r1}) ${isP1Win?'WON':'LOST'} vs P2(${r2-delta2}->${r2})`);
                }
            }

            // 9-Ball Processing
            if (p1Pts9 > 0 || p2Pts9 > 0) { // If played
                if (p1Pts9 !== p2Pts9) {
                    const isP1Win = p1Pts9 > p2Pts9;
                    const delta1 = calculateEloChange(r1, r2, isP1Win);
                    const delta2 = calculateEloChange(r2, r1, !isP1Win);

                    r1 += delta1;
                    r2 += delta2;
                    // console.log(`Match ${m.id} (9-Ball): P1(${r1-delta1}->${r1}) ${isP1Win?'WON':'LOST'} vs P2(${r2-delta2}->${r2})`);
                }
            }

            // Update Map
            ratings[p1] = r1;
            ratings[p2] = r2;
        }

        // 3. Bulk Update DB
        console.log("Updating database with new ratings...");
        for (const [id, rating] of Object.entries(ratings)) {
            // Only update if different from 500 or if we want to be sure
            await client.query(`UPDATE profiles SET fargo_rating = $1 WHERE id = $2`, [rating, id]);
            console.log(`Updated Player ${id}: ${rating} (Level ${getBreakpointLevel(rating)})`);
        }

        console.log("Recalculation Complete.");

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
