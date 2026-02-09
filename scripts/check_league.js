require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function checkLeagueDetails() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const res = await client.query("SELECT id, name, type, parent_league_id FROM leagues WHERE name = 'Test Session'");
        const league = res.rows[0];
        console.log('Test Session Details:', league);

        if (league && league.parent_league_id) {
            const parentRes = await client.query("SELECT id, name, type FROM leagues WHERE id = $1", [league.parent_league_id]);
            console.log('Parent League Details:', parentRes.rows[0]);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkLeagueDetails();
