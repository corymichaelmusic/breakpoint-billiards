
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function inspectStats() {
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

        // Profiles of interest
        const ids = [
            'user_38V0g7fCDSUhqvq7RiwpoDkI6W0', // Faithe
            'user_36G4WUMW9oc8aohN8s6FQUX6Xe9', // Cory 1
            'user_38GKAWlAxWgwMuoirhNpUxHRwWM'  // Cory 2
        ];

        const res = await client.query(`
            SELECT *
            FROM public.league_players 
            WHERE player_id = ANY($1)
        `, [ids]);

        console.log("League Players Records:", JSON.stringify(res.rows, null, 2));

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

inspectStats();
