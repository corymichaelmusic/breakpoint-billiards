require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function cleanupPlayers() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Find dummy profiles
        const res = await client.query("SELECT id, full_name FROM profiles WHERE full_name ILIKE '%Opponent%' OR full_name ILIKE '%Dummy%' OR full_name ILIKE '%Test Player%' OR full_name ILIKE '%Player 1%' OR full_name ILIKE '%Player 2%'");

        if (res.rows.length > 0) {
            console.log(`Found ${res.rows.length} dummy profiles. Deleting...`);
            for (const row of res.rows) {
                console.log(`Deleting ${row.full_name} (${row.id})`);
                // Use a single transaction or just delete them
                await client.query("DELETE FROM profiles WHERE id = $1", [row.id]);
            }
            console.log("Cleanup complete.");
        } else {
            console.log("No dummy profiles found in 'profiles' table.");
        }

    } catch (err) {
        console.error('Cleanup Error:', err);
    } finally {
        await client.end();
    }
}

cleanupPlayers();
