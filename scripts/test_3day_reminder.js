require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function updateMatch() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const userId = 'user_38GKAWlAxWgwMuoirhNpUxHRwWM';

        // Find next match
        const res = await client.query(
            "SELECT id, scheduled_date FROM matches WHERE (player1_id = $1 OR player2_id = $1) AND status NOT IN ('finalized', 'completed') AND scheduled_date >= CURRENT_DATE ORDER BY scheduled_date ASC LIMIT 1",
            [userId]
        );

        if (res.rows.length > 0) {
            const matchId = res.rows[0].id;
            const testDate = '2026-02-12';

            console.log(`Found match ${matchId} (currently ${res.rows[0].scheduled_date}). Updating to ${testDate}...`);

            await client.query("UPDATE matches SET scheduled_date = $1 WHERE id = $2", [testDate, matchId]);
            await client.query("DELETE FROM dismissed_reminders WHERE match_id = $1", [matchId]);

            console.log('Update successful and dismissals cleared.');
        } else {
            console.log('No upcoming matches found for this user.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

updateMatch();
