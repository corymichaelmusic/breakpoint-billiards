const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log('Connected to DB');

        // Add Boolean stats columns
        const columns = [
            'p1_break_run_8ball', 'p2_break_run_8ball',
            'p1_rack_run_8ball', 'p2_rack_run_8ball',
            'p1_break_run_9ball', 'p2_break_run_9ball',
            'p1_nine_on_snap', 'p2_nine_on_snap'
        ];

        for (const col of columns) {
            await client.query(`
                ALTER TABLE public.matches 
                ADD COLUMN IF NOT EXISTS ${col} BOOLEAN DEFAULT FALSE;
            `);
            console.log(`Added column: ${col}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
