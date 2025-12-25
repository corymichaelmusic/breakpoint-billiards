const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();

        const sessionName = "Test Session 2025";

        // 1. Get ID
        const res = await client.query(`SELECT id, name FROM leagues WHERE name = $1`, [sessionName]);
        if (res.rows.length === 0) {
            console.log(`Session '${sessionName}' not found.`);
            return;
        }

        const id = res.rows[0].id;
        console.log(`Found session '${sessionName}' with ID: ${id}`);

        // 2. Delete (Cascade should handle matches if configured, otherwise we might error)
        // We'll try deleting. If schema relies on cascade, it works. 
        // If not, we might need to delete matches first.
        // Let's try deleting the league directly.

        // However, usually we might want to delete matches first just in case.
        await client.query(`DELETE FROM games WHERE match_id IN (SELECT id FROM matches WHERE league_id = $1)`, [id]);
        await client.query(`DELETE FROM matches WHERE league_id = $1`, [id]);
        await client.query(`DELETE FROM league_players WHERE league_id = $1`, [id]);

        const delRes = await client.query(`DELETE FROM leagues WHERE id = $1`, [id]);
        console.log(`Deleted session '${sessionName}'. Count: ${delRes.rowCount}`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
