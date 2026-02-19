const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Use DATABASE_URL since it's the only one available
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error("No DATABASE_URL found in .env.local");
    process.exit(1);
}

const client = new Client({ connectionString: dbUrl });

(async () => {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT policyname, cmd, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'profiles';
        `);
        console.log("RLS Policies for 'profiles':");
        if (res.rows.length === 0) {
            console.log("No policies found!");
        }
        res.rows.forEach(r => {
            console.log(`\n- ${r.policyname} (${r.cmd}):`);
            console.log(`  USING: ${r.qual}`);
            if (r.with_check) console.log(`  WITH CHECK: ${r.with_check}`);
        });
    } catch (e) {
        console.error("Error querying policies:", e);
    } finally {
        await client.end();
    }
})();
