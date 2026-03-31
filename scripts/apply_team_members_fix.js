const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function applyFix() {
    console.log('Connecting to database...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
    });
    try {
        await client.connect();
        console.log('Connected.');
        
        const sql = `
            -- Drop problematic policies
            DROP POLICY IF EXISTS "Admins and Operators can ALL on team_members" ON public.team_members;
            DROP POLICY IF EXISTS "Enable read access for all users" ON public.team_members;

            -- Stable policies for Clerk
            DROP POLICY IF EXISTS "Admins can manage all team members" ON public.team_members;
            CREATE POLICY "Admins can manage all team members"
              ON public.team_members FOR ALL
              USING (
                EXISTS (
                  SELECT 1 FROM public.profiles
                  WHERE id = (auth.jwt() ->> 'sub')
                  AND role = 'admin'
                )
              );

            DROP POLICY IF EXISTS "Operators can manage team members in their leagues" ON public.team_members;
            CREATE POLICY "Operators can manage team members in their leagues"
              ON public.team_members FOR ALL
              USING (
                EXISTS (
                  SELECT 1 FROM public.teams t
                  JOIN public.leagues l ON l.id = t.league_id
                  WHERE t.id = team_members.team_id
                  AND l.operator_id = (auth.jwt() ->> 'sub')
                )
              );

            DROP POLICY IF EXISTS "Captains can manage their own team members" ON public.team_members;
            CREATE POLICY "Captains can manage their own team members"
              ON public.team_members FOR ALL
              USING (
                EXISTS (
                  SELECT 1 FROM public.teams
                  WHERE id = team_members.team_id
                  AND captain_id = (auth.jwt() ->> 'sub')
                )
              );

            DROP POLICY IF EXISTS "Anyone can view team members" ON public.team_members;
            CREATE POLICY "Anyone can view team members"
              ON public.team_members FOR SELECT
              USING (true);
        `;
        
        await client.query(sql);
        console.log('SUCCESS: team_members RLS policies updated.');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
        console.log('Connection closed.');
        process.exit(0);
    }
}
applyFix();
