const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();

        console.log("--- checking indexes ---");
        const res = await client.query(`
            SELECT tablename, indexname, indexdef 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename IN ('games', 'matches', 'league_players')
            ORDER BY tablename, indexname;
        `);

        res.rows.forEach(r => {
            console.log(`${r.tablename} | ${r.indexname}`);
        });

        console.log("\n--- checking table counts ---");
        const tables = ['games', 'matches', 'league_players'];
        for (const t of tables) {
            const countRes = await client.query(`SELECT count(*) FROM ${t}`);
            console.log(`${t}: ${countRes.rows[0].count}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
