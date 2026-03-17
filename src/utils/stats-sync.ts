import { createAdminClient } from "@/utils/supabase/admin";
import { getSessionStats } from "@/app/actions/stats-actions";

/**
 * Synchronizes the league_players table with the latest match data
 * for the specified players in a league.
 */
export async function syncLeaguePlayerStats(leagueId: string, playerIds: string[]) {
    console.log(`[StatsSync] Syncing stats for league ${leagueId}, players: ${playerIds.join(', ')}`);
    
    try {
        const supabase = createAdminClient();
        
        // 1. Get the latest calculated stats for the entire session
        // (We calculate for all to ensure ranks and win rates are consistent)
        const allStats = await getSessionStats(leagueId);
        
        // 2. Filter for the players we care about
        const targetStats = allStats.filter(s => playerIds.includes(s.playerId));
        
        // 3. Update league_players for each player
        for (const stats of targetStats) {
            const { error } = await supabase
                .from('league_players')
                .update({
                    matches_played: stats.matchesPlayed,
                    matches_won: stats.matchesWon,
                    shutouts: stats.display_shutouts,
                    breakpoint_racks_won: stats.racksWon_8ball + stats.racksWon_9ball,
                    breakpoint_racks_played: stats.racksPlayed_8ball + stats.racksPlayed_9ball
                })
                .eq('league_id', leagueId)
                .eq('player_id', stats.playerId);
                
            if (error) {
                console.error(`[StatsSync] Failed to update stats for player ${stats.playerId}:`, error);
            } else {
                console.log(`[StatsSync] Updated player ${stats.playerId}: ${stats.matchesWon}-${stats.matchesPlayed - stats.matchesWon}`);
            }
        }
        
        return { success: true };
    } catch (error) {
        console.error("[StatsSync] Error syncing stats:", error);
        return { error: "Failed to sync stats" };
    }
}
