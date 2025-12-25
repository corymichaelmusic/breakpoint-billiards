
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    await client.connect();
    try {
        console.log("Verifying League Players Stats...");
        const res = await client.query(`
            SELECT 
                player_id, 
                total_break_and_runs, 
                total_rack_and_runs, 
                total_nine_on_snap,
                total_win_zip,
                total_early_8
            FROM league_players 
            WHERE total_break_and_runs > 0 
               OR total_rack_and_runs > 0 
               OR total_nine_on_snap > 0
               OR total_win_zip > 0
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

verify();
