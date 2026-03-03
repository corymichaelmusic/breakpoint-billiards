const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const playerId = '08e063f9-71c1-4ba2-afd1-5d46bb2d35af';
    const leagueId = '2b08d033-f2cd-47cc-b6d8-78544a5df684'; // Spring 2026 session

    // 1. Identify Target Scope
    const { data: leagueInfo } = await supabase.from("leagues").select("id, type, parent_league_id").eq("id", leagueId).single();

    let targetLeagueId = leagueId;
    let isParent = false;

    if (leagueInfo) {
        if (leagueInfo.type === 'session' && leagueInfo.parent_league_id) {
            targetLeagueId = leagueInfo.parent_league_id;
            isParent = true;
        } else if (leagueInfo.type === 'league') {
            isParent = true;
        }
    }
    console.log("League Target:", targetLeagueId, "IsParent:", isParent);

    let validLeagueIds = [targetLeagueId];
    if (isParent) {
        // Fetch all child sessions
        const { data: children } = await supabase.from("leagues").select("id").eq("parent_league_id", targetLeagueId);
        if (children) {
            validLeagueIds = validLeagueIds.concat(children.map(c => c.id));
        }
    }
    console.log("Valid League IDs:", validLeagueIds);

    // 2. Fetch Matches
    let matchesQuery = supabase
        .from("matches")
        .select("id, player1_id, player2_id, winner_id, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, league_id")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .in("league_id", validLeagueIds);

    const { data: matches, error } = await matchesQuery;

    console.log("Matches retrieved:", matches?.length);
    if(error) console.error("Error:", JSON.stringify(error, null, 2));
    
    // Also test league_players aggregated fetch
    let leagueStatsQuery = supabase
        .from('league_players')
        .select('*')
        .eq('player_id', playerId)
        .in('league_id', validLeagueIds);
        
    const { data: ls, error: e3 } = await leagueStatsQuery;
    console.log("League Players retrieved:", ls?.length);
    if (e3) console.error("Agg Error:", e3);
}

run().catch(console.error);
