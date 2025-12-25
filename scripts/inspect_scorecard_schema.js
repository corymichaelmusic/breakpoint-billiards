
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function inspectSchema() {
    if (!dbUrl) {
        console.error("DATABASE_URL not found.");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();

        console.log("--- COLUMNS ---");
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'scorecard_entries';
        `);
        res.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type}`);
        });

        console.log("\n--- POLICIES ---");
        const policies = await client.query(`
            SELECT policyname, cmd, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'scorecard_entries';
        `);
        policies.rows.forEach(row => {
            console.log(`${row.policyname} (${row.cmd}): QUAL=${row.qual} WITH_CHECK=${row.with_check}`);
        });

        console.log("\n--- TRIGGERS ---");
        // Note: action_statement is not always visible/useful in info schema, use pg_trigger for internal details or just basic listing
        const triggers = await client.query(`
           SELECT trigger_name, action_timing, event_manipulation 
           FROM information_schema.triggers 
           WHERE event_object_table = 'scorecard_entries';
        `);
        triggers.rows.forEach(row => {
            console.log(`${row.trigger_name}: ${row.action_timing} ${row.event_manipulation}`);
        });
    } catch (e) {
        console.error("Inspection Error:", e);
    } finally {
        await client.end();
    }
}

inspectSchema();
