const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function enableRealtime() {
    console.log("Enabling Realtime for matches and games...");
    if (!dbUrl) {
        console.error("DATABASE_URL not found.");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();

        // 1. Add tables to publication
        // Note: IF NOT EXISTS checks specifically for the table in the publication are complex in pure SQL 
        // so we typically just run it and catch error or use a safe "try" block behavior if supported, 
        // but basically standard postgres will error if already there. 
        // We will try running them; if they fail because "relation already in publication", that's fine.

        try {
            await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;`);
            console.log("Added matches to realtime publication.");
        } catch (e) {
            console.log("Matches likely already in publication or error:", e.message);
        }

        try {
            await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.games;`);
            console.log("Added games to realtime publication.");
        } catch (e) {
            console.log("Games likely already in publication or error:", e.message);
        }

        // 2. Set Replica Identity
        await client.query(`ALTER TABLE public.matches REPLICA IDENTITY FULL;`);
        console.log("Set matches REPLICA IDENTITY to FULL");

        await client.query(`ALTER TABLE public.games REPLICA IDENTITY FULL;`);
        console.log("Set games REPLICA IDENTITY to FULL");

    } catch (e) {
        console.error("Script Error:", e);
        process.exit(1);
    } finally {
        await client.end();
    }
}

enableRealtime();
