
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    await client.connect();
    try {
        console.log("--- Profiles ---");
        const res = await client.query(`
            SELECT id, full_name, breakpoint_rating FROM profiles
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

inspect();
