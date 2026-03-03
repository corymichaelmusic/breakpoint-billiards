const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const playerId = '08e063f9-71c1-4ba2-afd1-5d46bb2d35af';
    // Use proper Spring 2026 session ID
    const leagueId = '2b08d033-f2cd-47cc-b6d8-78544a5df684';

    console.log("Testing getPlayerLeagueStats Query...");

    // 1. Target scope
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

    // 2. Fetch Matches exactly as in stats-actions.ts
    let matchesQuery = supabase
        .from("matches")
        .select("id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, is_forfeit, league_id, leagues!inner(parent_league_id, id)")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);

    if (isParent) {
        matchesQuery = matchesQuery.or(`league_id.eq.${targetLeagueId},leagues.parent_league_id.eq.${targetLeagueId}`);
    } else {
        matchesQuery = matchesQuery.eq("league_id", targetLeagueId);
    }

    const { data: matches, error } = await matchesQuery;

    console.log("Matches retrieved:", matches?.length);
    if (error) console.error("Error:", JSON.stringify(error, null, 2));

    // Fallback: Test without the leagues!inner join
    let matchesQuery2 = supabase
        .from("matches")
        .select("id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, is_forfeit, league_id")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)

    if (isParent) {
        console.log("Using complex parent match logic (not testing easily without join)");
    } else {
        matchesQuery2 = matchesQuery2.eq("league_id", targetLeagueId);
    }
    const { data: matches2, error: error2 } = await matchesQuery2;
    console.log("Matches retrieved (NO INNER JOIN):", matches2?.length);
    if (error2) console.error("Error NO JOIN:", JSON.stringify(error2, null, 2));

}

run().catch(console.error);
