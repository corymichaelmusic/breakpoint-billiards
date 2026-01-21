
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function verifySpecificMatch() {
    if (!process.env.DATABASE_URL) {
        console.error("Error: DATABASE_URL not found in .env.local");
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Find match involves players with names like Cory and Faithe
        const query = `
            SELECT 
                m.id, 
                p1.full_name as p1_name, 
                p2.full_name as p2_name,
                m.status_9ball,
                m.points_9ball_p1,
                m.points_9ball_p2,
                m.p1_verified_9ball,
                m.p2_verified_9ball
            FROM public.matches m
            JOIN public.profiles p1 ON m.player1_id = p1.id
            JOIN public.profiles p2 ON m.player2_id = p2.id
            WHERE (p1.full_name ILIKE '%Cory%' AND p2.full_name ILIKE '%Faithe%')
               OR (p1.full_name ILIKE '%Faithe%' AND p2.full_name ILIKE '%Cory%')
            ORDER BY m.created_at DESC
            LIMIT 1;
        `;

        const res = await client.query(query);

        if (res.rows.length > 0) {
            console.log("Match found:", res.rows[0]);
        } else {
            console.log("No match found between Cory and Faithe.");
        }

    } catch (err) {
        console.error("Error verifying match:", err);
    } finally {
        await client.end();
    }
}

verifySpecificMatch();
