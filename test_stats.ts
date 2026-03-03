import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // or SERVICE_ROLE_KEY
// Use service role if available for admin client simulation
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;
const supabase = createClient(supabaseUrl, key);

async function testStats() {
    const playerId = '08e063f9-71c1-4ba2-afd1-5d46bb2d35af'; // Cory Hinkley
    
    // Test Lifetime
    const { data: matches, error } = await supabase
        .from('matches')
        .select(`
            id, winner_id, player1_id, player2_id,
            points_8ball_p1, points_8ball_p2, 
            points_9ball_p1, points_9ball_p2,
            winner_id_8ball, winner_id_9ball,
            status_8ball, status_9ball
        `)
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
        
    console.log("Lifetime matches count:", matches?.length, error);
    
    // Test League
    const leagueId = '341cdb33-eadd-4db0-bb6d-bd4bffd81c03'; // Spring 2026 Session (approx guess, doesn't matter, we can test just the query)
    
    // Let's test the leagues inner join
    const { data: matchesLeague, error: e2 } = await supabase
        .from("matches")
        .select("id, status_8ball, status_9ball, leagues!inner(parent_league_id, id)")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .limit(5);
        
    console.log("League query test:", matchesLeague?.length, e2);
}

testStats().catch(console.error);
