const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();

        console.log("--- checking column types ---");
        const res = await client.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('leagues', 'league_players', 'matches')
            AND column_name IN ('operator_id', 'player_id', 'player1_id', 'player2_id')
            ORDER BY table_name, column_name;
        `);

        res.rows.forEach(r => {
            console.log(`${r.table_name} . ${r.column_name} : ${r.data_type}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
