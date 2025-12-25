const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function revertMatch() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const matchId = 'f01359d6-4fed-4fc1-9645-a2ed9c542204';

        const res = await client.query(`
            UPDATE matches 
            SET status_8ball = 'in_progress' 
            WHERE id = $1;
        `, [matchId]);

        console.log("Reverted match status to in_progress.");

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

revertMatch();
