const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function inspectState() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const matchRes = await client.query(`
            SELECT m.id, m.created_at, m.status, 
                   m.race_8ball_p1, m.race_8ball_p2, m.points_8ball_p1, m.points_8ball_p2, 
                   p1.full_name as p1_name, p2.full_name as p2_name
            FROM matches m
            LEFT JOIN profiles p1 ON m.player1_id = p1.id
            LEFT JOIN profiles p2 ON m.player2_id = p2.id
            ORDER BY m.created_at DESC LIMIT 5
        `);

        if (matchRes.rows.length === 0) {
            console.log("No matches found.");
            return;
        }

        console.log(`\n=== Last 5 Matches ===`);
        for (const match of matchRes.rows) {
            console.log(`ID: ${match.id} | ${match.created_at}`);
            console.log(`   ${match.p1_name} vs ${match.p2_name}`);
            console.log(`   8-Ball: ${match.points_8ball_p1}-${match.points_8ball_p2}`);
        }

        return;

    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

inspectState();
