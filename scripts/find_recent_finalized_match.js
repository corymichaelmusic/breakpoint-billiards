const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function findMatch() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const userId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

        // Find recent finalized matches for this user
        const res = await client.query(`
            SELECT m.id, m.created_at, m.status_8ball, m.status_9ball, 
                   m.points_8ball_p1, m.points_8ball_p2, 
                   m.points_9ball_p1, m.points_9ball_p2,
                   p1.full_name as p1_name, p1.id as p1_id,
                   p2.full_name as p2_name, p2.id as p2_id
            FROM matches m
            JOIN profiles p1 ON m.player1_id = p1.id
            JOIN profiles p2 ON m.player2_id = p2.id
            WHERE (m.player1_id = $1 OR m.player2_id = $1)
            AND (m.status_8ball = 'finalized' OR m.status_9ball = 'finalized')
            ORDER BY m.created_at DESC
            LIMIT 1;
        `, [userId]);

        const match = res.rows[0];
        console.log("Most Recent Finalized Match:", match);

        if (match) {
            // Count games for this match
            const gamesRes = await client.query(`
                SELECT count(*) as total_games, 
                       count(*) filter (where winner_id = $1) as my_wins
                FROM games 
                WHERE match_id = $2
            `, [userId, match.id]);
            console.log("Games Count:", gamesRes.rows[0]);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

findMatch();
