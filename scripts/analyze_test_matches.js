const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();

        // 1. Find the league
        const leagueRes = await client.query(`
            SELECT id FROM leagues WHERE name ILIKE '%test group 2%'
        `);

        if (leagueRes.rows.length === 0) {
            console.log("League not found");
            return;
        }

        const leagueId = leagueRes.rows[0].id;

        // 2. Get finalized matches
        const matchesRes = await client.query(`
            SELECT m.id, m.submitted_at,
                   m.score_8ball_p1, m.score_8ball_p2,
                   m.score_9ball_p1, m.score_9ball_p2,
                   m.status_8ball, m.status_9ball,
                   p1.full_name as p1_name, p1.id as p1_id,
                   p2.full_name as p2_name, p2.id as p2_id,
                   m.delta_8ball_p1, m.delta_8ball_p2,
                   m.delta_9ball_p1, m.delta_9ball_p2
            FROM matches m
            JOIN profiles p1 ON m.player1_id = p1.id
            JOIN profiles p2 ON m.player2_id = p2.id
            WHERE m.league_id = $1
            AND (m.status_8ball = 'finalized' OR m.status_9ball = 'finalized')
            ORDER BY m.submitted_at ASC
        `, [leagueId]);

        console.log(JSON.stringify(matchesRes.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
