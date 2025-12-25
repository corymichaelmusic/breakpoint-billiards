const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function reactivateAll() {
    await client.connect();

    try {
        const res = await client.query(`
      UPDATE profiles
      SET is_active = TRUE
      WHERE is_active = FALSE
      RETURNING id, full_name, email;
    `);

        console.log(`Reactivated ${res.rowCount} users:`);
        res.rows.forEach(row => {
            console.log(`- ${row.full_name} (${row.email})`);
        });

    } catch (err) {
        console.error('Error reactivating users:', err);
    } finally {
        await client.end();
    }
}

reactivateAll();
