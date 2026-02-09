require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function assignAdmin() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Get User ID
        const userRes = await client.query("SELECT id FROM profiles WHERE email = 'corymichaelmusic@gmail.com'");
        const userIds = userRes.rows.map(r => r.id);
        console.log('Found User IDs:', userIds);

        // 2. Get Test Session ID
        const leagueRes = await client.query("SELECT id, name FROM leagues WHERE name = 'Test Session'");
        const leagueId = leagueRes.rows[0]?.id;
        console.log('Found League ID:', leagueId);

        if (leagueId && userIds.length > 0) {
            for (const uid of userIds) {
                // Determine constraint name if possible or just try catch
                try {
                    await client.query(`
                        INSERT INTO league_operators (league_id, user_id) 
                        VALUES ($1, $2)
                        ON CONFLICT (league_id, user_id) DO NOTHING
                    `, [leagueId, uid]);
                    console.log(`Success: Added ${uid} to league ${leagueId}`);
                } catch (e) {
                    console.error(`Failed to add ${uid}:`, e.message);
                }
            }
        } else {
            console.error('Missing League or User ID');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

assignAdmin();
