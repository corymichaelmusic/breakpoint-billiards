require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const sql = process.argv[2];

if (!sql) {
    console.error('Please provide a SQL query as an argument');
    process.exit(1);
}

async function run() {
    console.log('Connecting to database...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('Connected!');

        console.log('Executing query:', sql);
        const res = await client.query(sql);
        console.table(res.rows);
    } catch (err) {
        console.error('Error executing query:', err);
    } finally {
        await client.end();
    }
}

run();
