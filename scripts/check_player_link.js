const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function checkPlayerLink() {
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        const res = await client.query(`SELECT league_id, count(*) FROM public.league_players GROUP BY league_id;`);
        console.log("Player Counts by League ID:", res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

checkPlayerLink();
