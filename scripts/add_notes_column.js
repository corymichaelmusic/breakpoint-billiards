require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    
    console.log('Adding notes column to matches table...');
    await client.query('ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS notes text;');
    console.log('✅ Column added successfully');
    
    await client.end();
}

main().catch(console.error);
