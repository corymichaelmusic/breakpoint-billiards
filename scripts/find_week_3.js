
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findWeek3() {
    console.log('Finding Week 3 matches...');
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT m.id, m.week_number, m.status, p1.full_name as p1, p2.full_name as p2, l.name as league
            FROM matches m
            JOIN profiles p1 ON m.player1_id = p1.id
            JOIN profiles p2 ON m.player2_id = p2.id
            JOIN leagues l ON m.league_id = l.id
            WHERE m.week_number = 3
            ORDER BY m.created_at DESC;
        `);

        console.log("Found matches:", JSON.stringify(res.rows, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

findWeek3();
