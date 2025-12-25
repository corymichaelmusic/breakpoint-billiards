const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    // Try without SSL first as per previous success
});

async function testConnection() {
    try {
        console.log("Connecting...");
        await client.connect();
        console.log("Connected. Running query...");
        const res = await client.query('SELECT NOW()');
        console.log("Query success:", res.rows[0]);
    } catch (err) {
        console.error("Connection error:", err);
    } finally {
        await client.end();
    }
}

testConnection();
