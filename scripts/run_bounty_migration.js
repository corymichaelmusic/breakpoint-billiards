const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

(async () => {
    try {
        await client.connect();
        const sql = fs.readFileSync('supabase/bounty_inheritance.sql', 'utf8');
        await client.query(sql);
        console.log("Migration successful: Dropped defaults and nullified session values.");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
})();
