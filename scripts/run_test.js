const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const filePath = process.argv[2];
if (!filePath) {
    console.error("Please provide a SQL file path");
    process.exit(1);
}

const sql = fs.readFileSync(filePath, 'utf8');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

client.on('notice', (msg) => console.log(msg.message));

(async () => {
    try {
        await client.connect();
        await client.query(sql);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
})();
