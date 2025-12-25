const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkLeagueDetails() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, name, type, parent_league_id, status 
            FROM leagues 
            WHERE name IN ('Spring 2026', 'Metro Pool League', 'Breakpoint Billiards Money Monday')
        `);
        console.log("League Details:", res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkLeagueDetails();
