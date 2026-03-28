const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function syncRatings() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const sql = fs.readFileSync(path.join(__dirname, '../supabase/sync_ratings_to_profiles.sql'), 'utf8');
        
        console.log('Executing sync script...');
        await client.query(sql);
        console.log('Successfully synced ratings.');

        // Manual check for Glenn
        const res = await client.query("SELECT id, full_name, breakpoint_rating FROM profiles WHERE full_name = 'Glenn Vinson'");
        console.log('Glenn Vinson final rating:', res.rows[0]);

    } catch (err) {
        console.error('Error syncing ratings:', err);
    } finally {
        await client.end();
    }
}

syncRatings();
