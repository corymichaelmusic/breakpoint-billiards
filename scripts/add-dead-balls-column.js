console.log("Script starting...");
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function addDeadBallsCount() {
    console.log("Connecting to:", process.env.DATABASE_URL ? "URL found" : "URL missing");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        await client.query(`
      ALTER TABLE games 
      ADD COLUMN IF NOT EXISTS dead_balls_count INTEGER DEFAULT 0;
`);

        console.log('Successfully added dead_balls_count column.');

    } catch (err) {
        console.error('Error running migration:', err);
    } finally {
        await client.end();
    }
}

addDeadBallsCount();
