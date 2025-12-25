
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function listTriggers() {
    await client.connect();
    try {
        console.log("Listing Triggers...");
        const res = await client.query(`
            SELECT event_object_table, trigger_name, action_statement
            FROM information_schema.triggers
            WHERE event_object_table = 'games' OR event_object_table = 'matches'
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

listTriggers();
