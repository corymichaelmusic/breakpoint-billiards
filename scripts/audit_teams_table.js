const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    try {
        const colRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'teams'");
        console.log('=== teams columns ===');
        colRes.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}
check();
