const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function deployTeamSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const schemaPath = path.join(__dirname, '../supabase/add_team_league_schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing team league schema...');
        await client.query(schemaSql);
        console.log('Team league schema deployed successfully');

    } catch (err) {
        console.error('Error executing schema:', err);
    } finally {
        await client.end();
    }
}

deployTeamSchema();
