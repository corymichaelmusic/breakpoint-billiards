const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function makeOperator() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const res = await client.query(`
      UPDATE public.profiles
      SET role = 'operator'
      RETURNING *;
    `);

        console.log('Updated users:', res.rows);

    } catch (err) {
        console.error('Error updating roles:', err);
    } finally {
        await client.end();
    }
}

makeOperator();
