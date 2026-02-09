require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function ensureAccess() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const users = await client.query("SELECT id FROM profiles WHERE email LIKE '%corymichaelmusic%'");
        const leagueId = 'abd204cd-2fa1-4cdf-91d2-439796a299e3'; // Money Mondays

        for (const user of users.rows) {
            console.log('Ensuring access for user:', user.id, 'to parent league:', leagueId);
            await client.query(`
                INSERT INTO league_operators (league_id, user_id) 
                VALUES ($1, $2) 
                ON CONFLICT (league_id, user_id) DO NOTHING
            `, [leagueId, user.id]);

            const check = await client.query("SELECT * FROM league_operators WHERE league_id = $1 AND user_id = $2", [leagueId, user.id]);
            console.log('Operator Access Confirmed:', check.rows.length > 0);
        }
    } catch (err) { console.error(err); }
    finally {
        await client.end();
    }
}

ensureAccess();
