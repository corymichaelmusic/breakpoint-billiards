const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9'; // Cory Michael

async function run() {
    await client.connect();

    try {
        console.log(`Simulating RLS for user: ${USER_ID}`);

        // 1. Set the transaction to simulate the user
        await client.query('BEGIN');
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [USER_ID]);
        await client.query(`SELECT set_config('role', 'authenticated', true)`);

        // 2. Run the query exactly as the app would (translated to SQL)
        const query = `
            SELECT 
                lp.league_id, 
                lp.status, 
                lp.payment_status, 
                l.id, 
                l.name, 
                l.type, 
                l.status as league_status
            FROM league_players lp
            JOIN leagues l ON lp.league_id = l.id
            WHERE lp.player_id = $1
            AND l.type = 'session'
            AND l.status IN ('setup', 'active', 'completed')
            ORDER BY lp.joined_at DESC;
        `;

        const res = await client.query(query, [USER_ID]);

        console.log(`Found ${res.rowCount} rows.`);
        res.rows.forEach(row => {
            console.log(row);
        });

        await client.query('COMMIT');
    } catch (e) {
        console.error(e);
        await client.query('ROLLBACK');
    } finally {
        await client.end();
    }
}

run();
