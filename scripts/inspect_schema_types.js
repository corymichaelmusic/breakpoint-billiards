
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    console.log("Inspecting league_players schema and leagues schema...");

    // We can't query information_schema easily via JS client usually, unless we have a wrapper or raw query.
    // 'exec_sql' is missing.
    // So we use the 'pg' client again.

    const { Client } = require('pg');
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("DATABASE_URL missing.");
        return;
    }
    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    try {
        const res = await client.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('league_players', 'leagues') 
            AND column_name IN ('player_id', 'operator_id', 'id')
            ORDER BY table_name, column_name;
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

inspectSchema();
