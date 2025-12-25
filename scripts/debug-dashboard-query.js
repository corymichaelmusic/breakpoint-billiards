const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = 'user_36G4WUMW9oc8aohN8s6FQUX6Xe9'; // Cory Michael

async function debugDashboardQuery() {
    console.log(`Simulating Dashboard Query for user: ${USER_ID}`);

    // 1. Set the config for RLS simulation
    // Note: This only works if we use a client that respects RLS, OR we use SQL with set_config.
    // Since we are using service_role key here, we need to manually switch to an authenticated client or use SQL.
    // But Supabase JS client with service_role key bypasses RLS.
    // To test RLS, we should use the ANON key and set the session? 
    // Or better, use SQL to set request.jwt.claim.sub.

    // Let's use SQL to simulate exactly what the server does.
    const { data, error } = await supabase.rpc('simulate_user_query', { user_id: USER_ID });

    // Wait, I don't have a generic RPC for this.
    // I'll just run the query using the JS client but I need to "act as" the user.
    // I can't easily do that without a valid JWT.

    // Alternative: Use SQL via pg (if I had it set up) or just trust my analysis.
    // But I can use the `debug-rls-simulation.js` approach if I have it.

    // Let's try to fetch using a client initialized with the ANON key, but I can't sign in without a password/token.

    // Okay, let's use the `postgres` library if available, or just use `supabase.rpc` if I create a helper.
    // I'll create a temporary RPC function to run the query as a specific user.

    const rpcSql = `
        create or replace function debug_dashboard_query(target_user_id text)
        returns json as $$
        declare
            result json;
        begin
            -- Set the config to simulate the user
            perform set_config('request.jwt.claim.sub', target_user_id, true);
            perform set_config('role', 'authenticated', true);
            
            select json_agg(t) into result
            from (
                select 
                    lp.league_id, 
                    lp.status, 
                    lp.payment_status, 
                    l.id as league_pk, 
                    l.name, 
                    l.type, 
                    l.status as league_status
                from league_players lp
                join leagues l on lp.league_id = l.id
                where lp.player_id = target_user_id
                and l.type = 'session'
                and l.status in ('setup', 'active', 'completed')
                order by lp.joined_at desc
            ) t;
            
            return result;
        end;
        $$ language plpgsql security definer;
    `;

    const { error: rpcError } = await supabase.rpc('exec_sql', { sql: rpcSql });
    // Wait, I don't have exec_sql. I have to use the SQL editor or a migration.
    // But I have the `pg` client in `scripts/apply-migration.js`. I can use that!
}

// I will use a separate script that uses `pg` to run the simulation.
console.log("Please run scripts/debug-dashboard-rls.js instead.");
