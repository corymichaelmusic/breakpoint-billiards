const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function debugWeek6() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const userId = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9';

        // 1. Find the Week 6 match
        const matchRes = await client.query(`
            SELECT m.id, m.week_number, m.scheduled_date, 
                   p1.full_name as p1, p2.full_name as p2
            FROM matches m
            JOIN profiles p1 ON m.player1_id = p1.id
            JOIN profiles p2 ON m.player2_id = p2.id
            WHERE (m.player1_id = $1 OR m.player2_id = $1)
            AND m.week_number = 6
            LIMIT 1;
        `, [userId]);

        const match = matchRes.rows[0];
        console.log("Week 6 Match:", match);

        if (match) {
            // 2. Check Requests
            const reqRes = await client.query(`
                SELECT * FROM reschedule_requests WHERE match_id = $1;
            `, [match.id]);
            console.log("Requests for Match:", reqRes.rows);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

debugWeek6();
