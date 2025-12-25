const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    console.log("--- Profiles Table Columns ---");
    const resCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'profiles';
    `);
    console.table(resCols.rows);

    console.log("\n--- Profiles Table Constraints ---");
    const resConstraints = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conrelid = 'profiles'::regclass;
    `);
    console.table(resConstraints.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
