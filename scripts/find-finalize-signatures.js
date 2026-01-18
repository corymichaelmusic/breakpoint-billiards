/**
 * Find all existing finalize_match_stats signatures
 */

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function findFunctions() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const result = await client.query(`
            SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE p.proname = 'finalize_match_stats'
            AND n.nspname = 'public';
        `);

        console.log("Found signatures:");
        result.rows.forEach((row, i) => {
            console.log(`${i + 1}. DROP FUNCTION IF EXISTS public.finalize_match_stats(${row.args});`);
        });

    } finally {
        await client.end();
    }
}

findFunctions();
