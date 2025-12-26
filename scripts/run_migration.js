const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

(async () => {
    try {
        await client.connect();
        const sql = fs.readFileSync('supabase/add_bounty_shutout.sql', 'utf8');
        await client.query(sql);
        console.log("Migration successful: Added bounty_val_shutout");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
})();
