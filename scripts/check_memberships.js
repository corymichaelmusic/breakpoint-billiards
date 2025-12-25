const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkMemberships() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        // We don't know the exact user ID string easily without asking, 
        // but we can query by name "Cory" if unique, or dump all valid memberships.
        // Or assume the user ID from the error message screenshot logic?
        // Let's just dump all memberships.
        const res = await client.query(`
            SELECT lp.*, l.name as league_name, l.status as league_status
            FROM league_players lp
            JOIN leagues l ON lp.league_id = l.id
            JOIN profiles p ON lp.player_id = p.id
            WHERE p.full_name ILIKE '%Cory%'
        `);
        console.log("Memberships for Cory:", res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkMemberships();
