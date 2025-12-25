const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function checkLeagues() {
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        const res = await client.query(`SELECT * FROM public.leagues;`);
        console.log("Leagues:", res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

checkLeagues();
