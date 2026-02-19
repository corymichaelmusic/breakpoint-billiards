'use server';

import { createAdminClient } from "@/utils/supabase/admin";
import { PlayerStats, getInitStats, aggregateMatchStats, getBreakpointLevel, calculateEloChange } from "@/utils/stats-calculator";

// Re-export for compatibility with existing imports 
export type { PlayerStats };
export { getInitStats, aggregateMatchStats };
export async function getSessionStats(sessionId: string): Promise<PlayerStats[]> {
    const supabase = createAdminClient();

    const statsMap = new Map<string, PlayerStats>();

    // 1. Fetch All Active Players in the Session (Roster)
    const { data: roster } = await supabase
        .from("league_players")
        .select("player_id, profiles:player_id(full_name, is_active)")
        .eq("league_id", sessionId)
        .eq("status", "active")
        .eq("profiles.is_active", true);

    // Initialize stats for every player in the roster
    if (roster && roster.length > 0) {
        roster.forEach(membership => {
            const pid = membership.player_id;
            const pName = Array.isArray(membership.profiles) ? membership.profiles[0]?.full_name : (membership.profiles as any)?.full_name;
            statsMap.set(pid, getInitStats(pid, pName || "Unknown"));
        });
    }

    // 2. Fetch Matches with Player Ratings (Finalized only)
    const { data: matches } = await supabase
        .from("matches")
        .select("id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, is_forfeit, player1:player1_id(full_name, fargo_rating), player2:player2_id(full_name, fargo_rating)")
        .eq("league_id", sessionId)
        // .or("status.eq.finalized,winner_id.not.is.null") // REMOVED: Fetch all to allow scheduled games with scores to count
        .order("scheduled_date", { ascending: true });

    // 3. Fetch Games for these matches (for detailed stats)
    let allGames: any[] = [];
    if (matches && matches.length > 0) {
        const matchIds = matches.map(m => m.id);
        const { data: games } = await supabase
            .from("games")
            .select("*")
            .in("match_id", matchIds);
        allGames = games || [];

        matches.forEach(match => {
            // Player 1
            if (!statsMap.has(match.player1_id)) {
                // Should already be there if in roster, but safety check for legacy/removed players
                const p1Data = match.player1;
                const p1Name = Array.isArray(p1Data) ? p1Data[0]?.full_name : (p1Data as any)?.full_name;
                statsMap.set(match.player1_id, getInitStats(match.player1_id, p1Name || "Unknown"));
            }
            aggregateMatchStats(statsMap.get(match.player1_id)!, match, match.player1_id, allGames);

            // Player 2
            if (!statsMap.has(match.player2_id)) {
                const p2Data = match.player2;
                const p2Name = Array.isArray(p2Data) ? p2Data[0]?.full_name : (p2Data as any)?.full_name;
                statsMap.set(match.player2_id, getInitStats(match.player2_id, p2Name || "Unknown"));
            }
            aggregateMatchStats(statsMap.get(match.player2_id)!, match, match.player2_id, allGames);
        });
    }

    // Calculate Ratings for Session (Internal tracker, or fetch from profiles?)
    // Re-calculating purely from session matches for "Session Rating" context, 
    // or just assume everyone is 500 base?
    // Let's stick to the previous logic which seemed to calc running ELO.

    const ratings = new Map<string, number>();
    // Reset everyone to 500 for this session calc
    statsMap.forEach((_, pid) => ratings.set(pid, 500));

    if (matches && matches.length > 0) {
        matches.forEach(match => {
            const p1Rating = ratings.get(match.player1_id) || 500;
            const p2Rating = ratings.get(match.player2_id) || 500;

            let isP1Win = false;
            let isDraw = false;

            if (match.winner_id) {
                if (match.winner_id === match.player1_id) isP1Win = true;
                else isP1Win = false;
            } else {
                const p1Points = (Number(match.points_8ball_p1) || 0) + (Number(match.points_9ball_p1) || 0);
                const p2Points = (Number(match.points_8ball_p2) || 0) + (Number(match.points_9ball_p2) || 0);
                if (p1Points > p2Points) isP1Win = true;
                else if (p2Points > p1Points) isP1Win = false;
                else isDraw = true;
            }

            if (!isDraw) {
                const p1Delta = calculateEloChange(p1Rating, p2Rating, isP1Win);
                const p2Delta = calculateEloChange(p2Rating, p1Rating, !isP1Win);

                ratings.set(match.player1_id, p1Rating + p1Delta);
                ratings.set(match.player2_id, p2Rating + p2Delta);
            }
        });
    }

    // Calculate Averages and Assign Rating
    const statsArray = Array.from(statsMap.values()).map(stat => {
        stat.pointsPerMatch = stat.matchesPlayed > 0 ? (stat.totalPoints / stat.matchesPlayed).toFixed(2) : "0.00";
        stat.winRate = stat.matchesPlayed > 0 ? Math.round((stat.matchesWon / stat.matchesPlayed) * 100) : 0;

        stat.winRate_8ball = stat.matchesPlayed_8ball > 0 ? Math.round((stat.matchesWon_8ball / stat.matchesPlayed_8ball) * 100) : 0;
        stat.winRate_9ball = stat.matchesPlayed_9ball > 0 ? Math.round((stat.matchesWon_9ball / stat.matchesPlayed_9ball) * 100) : 0;

        // Assign Calculated Breakpoint
        const finalRating = ratings.get(stat.playerId) || 500;
        stat.breakPoint = parseFloat(getBreakpointLevel(finalRating));

        return stat;
    });

    // Sort by Win Rate (desc), then Rack Win % (desc)
    statsArray.sort((a, b) => {
        // Primary: Win Rate (Set)
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        // Secondary: Combined Rack Win %
        const aRackWinRate = a.totalRacksPlayed > 0 ? (a.racksWon_8ball + a.racksWon_9ball) / a.totalRacksPlayed : 0;
        const bRackWinRate = b.totalRacksPlayed > 0 ? (b.racksWon_8ball + b.racksWon_9ball) / b.totalRacksPlayed : 0;
        return bRackWinRate - aRackWinRate;
    });

    // Assign Ranks
    statsArray.forEach((stat, index) => {
        stat.rank = index + 1;
    });

    return statsArray;
}

export async function getSessionLeaderboard(sessionId: string, limit: number = 10) {
    const stats = await getSessionStats(sessionId);
    // Sort by win rate, then rack win %
    const sortedStats = stats.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        const aRackWinRate = a.totalRacksPlayed > 0 ? (a.racksWon_8ball + a.racksWon_9ball) / a.totalRacksPlayed : 0;
        const bRackWinRate = b.totalRacksPlayed > 0 ? (b.racksWon_8ball + b.racksWon_9ball) / b.totalRacksPlayed : 0;
        return bRackWinRate - aRackWinRate;
    });

    // Assign Rank
    const rankedStats = sortedStats.map((stat, index) => ({
        ...stat,
        rank: index + 1
    }));

    if (limit > 0) {
        return rankedStats.slice(0, limit);
    }
    return rankedStats;
}

export async function getPlayerLifetimeStats(playerId: string) {
    const supabase = createAdminClient();

    // 1. Fetch All Finalized Matches for Player
    // 1. Fetch All Matches for Player (Relaxed Filter)
    // 1. Fetch All Matches for Player (Relaxed Filter)
    const { data: matches } = await supabase
        .from("matches")
        .select(`
            id, 
            status, 
            winner_id, 
            player1_id, 
            player2_id,
            points_8ball_p1, points_8ball_p2, 
            points_9ball_p1, points_9ball_p2,
            winner_id_8ball, winner_id_9ball,
            status_8ball, status_9ball,
            is_forfeit,
            submitted_by
        `)
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);

    console.log(`[LifetimeStats] Found ${matches?.length} matches for ${playerId}`);

    if (!matches || matches.length === 0) {
        return {
            matchesPlayed: 0,
            matchesWon: 0,
            matchesLost: 0,

            totalPoints: 0,
            pointsPerMatch: "0.00",
            winRate: 0,
            totalRacksPlayed: 0,
            matchesPlayed_8ball: 0,
            matchesWon_8ball: 0,
            matchesLost_8ball: 0,
            winRate_8ball: 0,
            racksWon_8ball: 0,
            racksPlayed_8ball: 0,

            matchesPlayed_9ball: 0,
            matchesWon_9ball: 0,
            matchesLost_9ball: 0,
            winRate_9ball: 0,
            racksWon_9ball: 0,
            racksPlayed_9ball: 0,
            racklessSets_8ball: 0,
            racklessSets_9ball: 0,
            breakAndRuns_8ball: 0,
            rackAndRuns_8ball: 0,
            breakAndRuns_9ball: 0,
            rackAndRuns_9ball: 0,
            winZips_9ball: 0,
            nineOnSnaps_9ball: 0,
            breakPoint: 0 // Default for no matches
        };
    }

    // 2. Fetch Games for these matches
    const matchIds = matches.map(m => m.id);
    const { data: games } = await supabase
        .from("games")
        .select("*")
        .in("match_id", matchIds);

    const allGames = games || [];



    // Fetch Profile Rating
    const { data: profile } = await supabase.from("profiles").select("fargo_rating, breakpoint_rating").eq("id", playerId).single();
    const currentRating = profile?.breakpoint_rating || 500;

    const stats = getInitStats(playerId, "Player");
    stats.breakPoint = parseFloat(getBreakpointLevel(currentRating));

    matches.forEach(match => {
        aggregateMatchStats(stats, match, playerId, allGames);
    });

    stats.pointsPerMatch = stats.matchesPlayed > 0 ? (stats.totalPoints / stats.matchesPlayed).toFixed(2) : "0.00";
    stats.winRate = stats.matchesPlayed > 0 ? Math.round((stats.matchesWon / stats.matchesPlayed) * 100) : 0;
    stats.winRate_8ball = stats.matchesPlayed_8ball > 0 ? Math.round((stats.matchesWon_8ball / stats.matchesPlayed_8ball) * 100) : 0;
    stats.winRate_9ball = stats.matchesPlayed_9ball > 0 ? Math.round((stats.matchesWon_9ball / stats.matchesPlayed_9ball) * 100) : 0;

    return stats;
}

export async function getPlayerSessionStats(playerId: string, sessionId: string) {
    const supabase = createAdminClient();

    // 1. Fetch Finalized Matches for Player in Session
    // Fetch all matches for the player that are not just scheduled
    const { data: matches } = await supabase
        .from("matches")
        .select(`
            id, 
            status, 
            winner_id, 
            player1_id, 
            player2_id,
            points_8ball_p1, points_8ball_p2, 
            points_9ball_p1, points_9ball_p2,
            winner_id_8ball, winner_id_9ball,
            status_8ball, status_9ball,
            is_forfeit,
            submitted_by
        `)
        .eq("league_id", sessionId)
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);

    console.log(`[Stats] Found ${matches?.length} matches for ${playerId} (ignoring status filter)`);

    if (!matches || matches.length === 0) {
        return getInitStats(playerId, "Player");
    }

    // 2. Fetch Games for these matches
    const matchIds = matches.map(m => m.id);
    const { data: games } = await supabase
        .from("games")
        .select("*")
        .in("match_id", matchIds);

    const allGames = games || [];

    // Calculate Global Confidence Score (Lifetime Games Played)
    // We need to fetch ALL matches for this player globally to count total racks
    const { data: globalMatches } = await supabase
        .from("matches")
        .select("id")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .not("status", "eq", "scheduled"); // Only played matches

    let lifetimeGames = 0;
    if (globalMatches && globalMatches.length > 0) {
        const globalMatchIds = globalMatches.map(m => m.id);
        const { count } = await supabase
            .from("games")
            .select("*", { count: 'exact', head: true })
            .in("match_id", globalMatchIds);
        lifetimeGames = count || 0;
    }



    // Fetch Profile Rating
    const { data: profile } = await supabase.from("profiles").select("fargo_rating, breakpoint_rating").eq("id", playerId).single();
    const currentRating = profile?.breakpoint_rating || 500;

    const stats = getInitStats(playerId, "Player");
    stats.breakPoint = parseFloat(getBreakpointLevel(currentRating));

    matches.forEach(match => {
        aggregateMatchStats(stats, match, playerId, allGames);
    });

    stats.pointsPerMatch = stats.matchesPlayed > 0 ? (stats.totalPoints / stats.matchesPlayed).toFixed(2) : "0.00";
    stats.winRate = stats.matchesPlayed > 0 ? Math.round((stats.matchesWon / stats.matchesPlayed) * 100) : 0;
    stats.winRate_8ball = stats.matchesPlayed_8ball > 0 ? Math.round((stats.matchesWon_8ball / stats.matchesPlayed_8ball) * 100) : 0;
    stats.winRate_9ball = stats.matchesPlayed_9ball > 0 ? Math.round((stats.matchesWon_9ball / stats.matchesPlayed_9ball) * 100) : 0;

    return stats;
}

export async function getPlayerBreakpointHistory(playerId: string) {
    // This is a minimal implementation based on assumption. 
    // If there was complex logic here, it needs to be restored.
    // Assuming it fetches rating history or match history to calculate progress.
    const supabase = createAdminClient();

    // Fetch matches in date order
    const { data: matches } = await supabase
        .from("matches")
        .select("scheduled_date, player1_id, player2_id, winner_id, is_forfeit, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, player1:player1_id(fargo_rating), player2:player2_id(fargo_rating)")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        // Exclude forfeited matches from rating/history as per previous requirement
        // Exclude forfeited matches from rating/history as per previous requirement
        .or("status.eq.finalized,winner_id.not.is.null")
        .eq("is_forfeit", false)
        .order("scheduled_date", { ascending: true });

    if (!matches || matches.length === 0) return [];

    // Calculate rating history
    // Start everyone at 500 (Level 5)
    let currentRating = 500;

    const history = matches.map(match => {
        // Determine outcome
        let isWin = false;
        let isLoss = false;

        const isP1 = match.player1_id === playerId;
        // Determine Opponent Rating (Approximate using their current rating)
        // If we want detailed history we'd need to simulate everyone. 
        // For now, use their current DB rating as the "Opponent Strength".
        const opponentProfile = isP1 ? match.player2 : match.player1;
        const opponentRating = (opponentProfile as any)?.fargo_rating || 500;

        if (match.winner_id) {
            if (match.winner_id === playerId) isWin = true;
            else isLoss = true;
        } else {
            // Fallback for legacy
            // Uses explicit Number casting from earlier fix
            const p1Points = (Number(match.points_8ball_p1) || 0) + (Number(match.points_9ball_p1) || 0);
            const p2Points = (Number(match.points_8ball_p2) || 0) + (Number(match.points_9ball_p2) || 0);
            const myPoints = isP1 ? p1Points : p2Points;
            const oppPoints = isP1 ? p2Points : p1Points;
            if (myPoints > oppPoints) isWin = true;
            else if (oppPoints > myPoints) isLoss = true;
        }

        const delta = calculateEloChange(currentRating, opponentRating, isWin);

        // Prevent rating from dropping below 100 or exceeding 1000 effectively?
        // Or just let it float.
        currentRating += delta;

        // Return Breakpoint Level
        return {
            date: match.scheduled_date,
            rating: parseFloat(getBreakpointLevel(currentRating))
        };
    });

    return history;
}

export async function calculatePlayerRating(playerId: string) {
    const supabase = createAdminClient();

    // Fetch user profile for base Fargo
    const { data: profile } = await supabase.from("profiles").select("fargo_rating, breakpoint_rating").eq("id", playerId).single();
    const startRating = 500; // User requested Fargo be taken out. Everyone starts at 500.

    const { data: matches } = await supabase
        .from("matches")
        .select("*, player1:player1_id(fargo_rating), player2:player2_id(fargo_rating)")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .eq("status", "finalized")
        .eq("is_forfeit", false)
        .order('scheduled_date', { ascending: true }); // Process chronologically

    // Start everyone at 500
    let currentRating = 500;

    if (matches && matches.length > 0) {
        matches.forEach(match => {
            // Determine outcome
            let isWin = false;
            let isLoss = false;
            const isP1 = match.player1_id === playerId;

            const opponentProfile = isP1 ? match.player2 : match.player1;
            const opponentRating = (opponentProfile as any)?.fargo_rating || 500;

            if (match.winner_id) {
                if (match.winner_id === playerId) isWin = true;
                else isLoss = true;
            } else {
                // Fallback for legacy
                // Uses explicit Number casting from earlier fix
                const p1Points = (Number(match.points_8ball_p1) || 0) + (Number(match.points_9ball_p1) || 0);
                const p2Points = (Number(match.points_8ball_p2) || 0) + (Number(match.points_9ball_p2) || 0);
                const myPoints = isP1 ? p1Points : p2Points;
                const oppPoints = isP1 ? p2Points : p1Points;
                if (myPoints > oppPoints) isWin = true;
                else if (oppPoints > myPoints) isLoss = true;
            }

            const delta = calculateEloChange(currentRating, opponentRating, isWin);
            currentRating += delta;
        });
    }

    return getBreakpointLevel(currentRating);
}

export async function getLeagueStats(leagueId: string): Promise<PlayerStats[]> {
    const supabase = createAdminClient();

    // 1. Fetch All Sessions for this League (if it's a parent league) or just matches if it's a session?
    // Actually getLeagueStats usually aggregates across all sessions in a league.

    // Fetch matches for the league
    const { data: matches } = await supabase
        .from("matches")
        .select("id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, is_forfeit, player1:player1_id(full_name, fargo_rating, is_active), player2:player2_id(full_name, fargo_rating, is_active), league_id, leagues!inner(parent_league_id)")
        .eq("leagues.parent_league_id", leagueId) // Assuming leagueId is the Parent Key
        .or("status.eq.finalized,winner_id.not.is.null")
        .eq("player1.is_active", true)
        .eq("player2.is_active", true);

    if (!matches || matches.length === 0) return [];

    // 2. Fetch Games
    const matchIds = matches.map(m => m.id);
    const { data: games } = await supabase
        .from("games")
        .select("*")
        .in("match_id", matchIds);

    const allGames = games || [];

    const statsMap = new Map<string, PlayerStats>();

    matches.forEach(match => {
        // Player 1
        if (!statsMap.has(match.player1_id)) {
            const p1Data = match.player1;
            const p1Name = Array.isArray(p1Data) ? p1Data[0]?.full_name : (p1Data as any)?.full_name;
            const p1Rating = Array.isArray(p1Data) ? p1Data[0]?.fargo_rating : (p1Data as any)?.fargo_rating;

            const p1Stats = getInitStats(match.player1_id, p1Name || "Unknown");
            p1Stats.breakPoint = parseFloat(getBreakpointLevel(p1Rating || 500));
            statsMap.set(match.player1_id, p1Stats);
        }
        aggregateMatchStats(statsMap.get(match.player1_id)!, match, match.player1_id, allGames);

        // Player 2
        if (!statsMap.has(match.player2_id)) {
            const p2Data = match.player2;
            const p2Name = Array.isArray(p2Data) ? p2Data[0]?.full_name : (p2Data as any)?.full_name;
            const p2Rating = Array.isArray(p2Data) ? p2Data[0]?.fargo_rating : (p2Data as any)?.fargo_rating;

            const p2Stats = getInitStats(match.player2_id, p2Name || "Unknown");
            p2Stats.breakPoint = parseFloat(getBreakpointLevel(p2Rating || 500));
            statsMap.set(match.player2_id, p2Stats);
        }
        aggregateMatchStats(statsMap.get(match.player2_id)!, match, match.player2_id, allGames);
    });

    // Calculate Averages
    const statsArray = Array.from(statsMap.values()).map(stat => {
        stat.pointsPerMatch = stat.matchesPlayed > 0 ? (stat.totalPoints / stat.matchesPlayed).toFixed(2) : "0.00";
        stat.winRate = stat.matchesPlayed > 0 ? Math.round((stat.matchesWon / stat.matchesPlayed) * 100) : 0;

        stat.winRate_8ball = stat.matchesPlayed_8ball > 0 ? Math.round((stat.matchesWon_8ball / stat.matchesPlayed_8ball) * 100) : 0;
        stat.winRate_9ball = stat.matchesPlayed_9ball > 0 ? Math.round((stat.matchesWon_9ball / stat.matchesPlayed_9ball) * 100) : 0;

        return stat;
    });

    // Sort by Win Rate (desc), then Rack Win % (desc)
    statsArray.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        const aRackWinRate = a.totalRacksPlayed > 0 ? (a.racksWon_8ball + a.racksWon_9ball) / a.totalRacksPlayed : 0;
        const bRackWinRate = b.totalRacksPlayed > 0 ? (b.racksWon_8ball + b.racksWon_9ball) / b.totalRacksPlayed : 0;
        return bRackWinRate - aRackWinRate;
    });

    // Assign Ranks
    statsArray.forEach((stat, index) => {
        stat.rank = index + 1;
    });

    return statsArray;
}

export async function getPlayerLeagueStats(playerId: string, leagueId: string) {
    const supabase = createAdminClient();

    // 1. Identify Target Scope (Is leagueId a Parent or Session?)
    // We assume the intent is "Stats for this League Organization".
    // So if leagueId is a Session, find its Parent. If Parent, use it.

    // Check if leagueId is a parent
    const { data: leagueInfo } = await supabase.from("leagues").select("id, type, parent_league_id").eq("id", leagueId).single();

    let targetLeagueId = leagueId; // Default to provided ID
    let isParent = false;

    if (leagueInfo) {
        if (leagueInfo.type === 'session' && leagueInfo.parent_league_id) {
            targetLeagueId = leagueInfo.parent_league_id;
            isParent = true;
        } else if (leagueInfo.type === 'league') {
            isParent = true;
        }
    }

    // 2. Fetch Matches
    // If Parent: Matches where match.league_id IN (children of targetLeagueId)
    // If Session/Single: Matches where match.league_id = targetLeagueId
    // Actually simpler: 
    // If Parent: Join leagues to filter by parent_league_id of the match's league.
    // Or fetch all session IDs first.

    let matchesQuery = supabase
        .from("matches")
        .select("id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, is_forfeit, league_id, leagues!inner(parent_league_id)")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .or("status.eq.finalized,winner_id.not.is.null"); // Only finalized

    if (isParent) {
        matchesQuery = matchesQuery.eq("leagues.parent_league_id", targetLeagueId);
    } else {
        // Fallback if we just want single league stats
        matchesQuery = matchesQuery.eq("league_id", targetLeagueId);
    }

    const { data: matches } = await matchesQuery;

    // Fetch Profile Rating for BreakPoint Level (Always fetch this)
    const { data: profile } = await supabase.from("profiles").select("breakpoint_rating").eq("id", playerId).single();
    const currentRating = profile?.breakpoint_rating || 500;
    const breakPointLevel = parseFloat(getBreakpointLevel(currentRating));

    if (!matches || matches.length === 0) {
        const emptyStats = getInitStats(playerId, "Player");
        emptyStats.breakPoint = breakPointLevel;
        return emptyStats;
    }

    // 3. Fetch Games
    const matchIds = matches.map(m => m.id);
    const { data: games } = await supabase
        .from("games")
        .select("*")
        .in("match_id", matchIds);

    const allGames = games || [];
    const stats = getInitStats(playerId, "Player");
    stats.breakPoint = breakPointLevel;

    matches.forEach(match => {
        aggregateMatchStats(stats, match, playerId, allGames);
    });

    stats.pointsPerMatch = stats.matchesPlayed > 0 ? (stats.totalPoints / stats.matchesPlayed).toFixed(2) : "0.00";
    stats.winRate = stats.matchesPlayed > 0 ? Math.round((stats.matchesWon / stats.matchesPlayed) * 100) : 0;
    stats.winRate_8ball = stats.matchesPlayed_8ball > 0 ? Math.round((stats.matchesWon_8ball / stats.matchesPlayed_8ball) * 100) : 0;
    stats.winRate_9ball = stats.matchesPlayed_9ball > 0 ? Math.round((stats.matchesWon_9ball / stats.matchesPlayed_9ball) * 100) : 0;

    return stats;
}

export async function getGlobalLeaderboard(limit: number = 10) {
    const supabase = createAdminClient();

    // 1. Fetch ALL Finalized Matches
    const { data: matches } = await supabase
        .from("matches")
        .select("id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, is_forfeit, player1:player1_id(full_name, fargo_rating, breakpoint_rating), player2:player2_id(full_name, fargo_rating, breakpoint_rating)")
        .or("status.eq.finalized,winner_id.not.is.null");

    if (!matches || matches.length === 0) return [];

    // 2. Fetch Games
    const matchIds = matches.map(m => m.id);
    const { data: games } = await supabase
        .from("games")
        .select("*")
        .in("match_id", matchIds);

    const allGames = games || [];

    const statsMap = new Map<string, PlayerStats>();

    matches.forEach(match => {
        // Player 1
        if (!statsMap.has(match.player1_id)) {
            const p1Data = match.player1;
            const p1Name = Array.isArray(p1Data) ? p1Data[0]?.full_name : (p1Data as any)?.full_name;
            const p1Rating = Array.isArray(p1Data) ? p1Data[0]?.breakpoint_rating : (p1Data as any)?.breakpoint_rating;

            const p1Stats = getInitStats(match.player1_id, p1Name || "Unknown");
            p1Stats.breakPoint = parseFloat(getBreakpointLevel(p1Rating || 500));
            statsMap.set(match.player1_id, p1Stats);
        }
        aggregateMatchStats(statsMap.get(match.player1_id)!, match, match.player1_id, allGames);

        // Player 2
        if (!statsMap.has(match.player2_id)) {
            const p2Data = match.player2;
            const p2Name = Array.isArray(p2Data) ? p2Data[0]?.full_name : (p2Data as any)?.full_name;
            const p2Rating = Array.isArray(p2Data) ? p2Data[0]?.breakpoint_rating : (p2Data as any)?.breakpoint_rating;

            const p2Stats = getInitStats(match.player2_id, p2Name || "Unknown");
            p2Stats.breakPoint = parseFloat(getBreakpointLevel(p2Rating || 500));
            statsMap.set(match.player2_id, p2Stats);
        }
        aggregateMatchStats(statsMap.get(match.player2_id)!, match, match.player2_id, allGames);
    });

    // Calculate Averages
    const statsArray = Array.from(statsMap.values()).map(stat => {
        stat.pointsPerMatch = stat.matchesPlayed > 0 ? (stat.totalPoints / stat.matchesPlayed).toFixed(2) : "0.00";
        stat.winRate = stat.matchesPlayed > 0 ? Math.round((stat.matchesWon / stat.matchesPlayed) * 100) : 0;
        stat.winRate_8ball = stat.matchesPlayed_8ball > 0 ? Math.round((stat.matchesWon_8ball / stat.matchesPlayed_8ball) * 100) : 0;
        stat.winRate_9ball = stat.matchesPlayed_9ball > 0 ? Math.round((stat.matchesWon_9ball / stat.matchesPlayed_9ball) * 100) : 0;
        return stat;
    });

    // Sort by Win Rate (desc), then Points
    statsArray.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return b.matchesWon - a.matchesWon;
    });

    // Assign Ranks
    statsArray.forEach((stat, index) => {
        stat.rank = index + 1;
    });

    if (limit > 0) return statsArray.slice(0, limit);
    return statsArray;
}

export async function getPlayerActiveLeagues(playerId: string) {
    const supabase = createAdminClient();

    const { data: memberships } = await supabase
        .from("league_players")
        .select("league_id, leagues(id, name, status, type, parent_league_id)")
        .eq("player_id", playerId);

    if (!memberships) return [];

    // Filter to finding unique parent leagues or active sessions
    // Ideally we show the User-Facing League Name.
    // If it's a session, maybe show "Session Name (League Name)"?
    // For now, just listed all attached leagues.

    return memberships.map(m => m.leagues).filter(l => l !== null);
}
