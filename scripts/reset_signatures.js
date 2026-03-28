require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function resetSignatures() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query("UPDATE public.profiles SET bylaws_agreed = false WHERE bylaws_agreed = true RETURNING id, full_name");
        console.log(`Success! Reset bylaws signatures for ${res.rowCount} player(s).`);
        res.rows.forEach(r => console.log(`  - ${r.full_name} (${r.id})`));
    } catch (e) {
        console.error("Reset failed:", e);
    } finally {
        await client.end();
    }
}

resetSignatures();
