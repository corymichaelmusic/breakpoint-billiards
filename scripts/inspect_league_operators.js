const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function inspect() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("--- League Operators ---");
        const res = await client.query(`SELECT * FROM league_operators`);
        if (res.rows.length === 0) {
            console.log("Table is empty.");
        } else {
            console.table(res.rows);
        }

        console.log("\n--- Assigned Leagues Details ---");
        if (res.rows.length > 0) {
            const ids = res.rows.map(r => `'${r.league_id}'`).join(',');
            const leagues = await client.query(`SELECT id, name, operator_id FROM leagues WHERE id IN (${ids})`);
            console.table(leagues.rows);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspect();
