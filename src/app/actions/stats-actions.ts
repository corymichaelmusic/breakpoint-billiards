'use server';

import { createAdminClient } from "@/utils/supabase/admin";

export type PlayerStats = {
    playerId: string;
    playerName: string;
    rank?: number;
    matchesPlayed: number;
    matchesWon: number;
    matchesLost: number;
    totalPoints: number;
    pointsPerMatch: string;
    winRate: number;
    breakPoint?: number; // Added Breakpoint Level
    // Breakdown Stats
    matchesPlayed_8ball: number;
    matchesWon_8ball: number;
    matchesLost_8ball: number;
    winRate_8ball: number;

    matchesPlayed_9ball: number;
    matchesWon_9ball: number;
    matchesLost_9ball: number;
    winRate_9ball: number;

    racklessSets_8ball: number;
    racklessSets_9ball: number;

    // Detailed Stats
    breakAndRuns_8ball: number;
    rackAndRuns_8ball: number;
    breakAndRuns_9ball: number;
    rackAndRuns_9ball: number;
    winZips_9ball: number;
    nineOnSnaps_9ball: number;
};

function getInitStats(playerId: string, playerName: string): PlayerStats {
    return {
        playerId,
        playerName,
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        totalPoints: 0,
        pointsPerMatch: "0.00",
        winRate: 0,

        matchesPlayed_8ball: 0,
        matchesWon_8ball: 0,
        matchesLost_8ball: 0,
        winRate_8ball: 0,

        matchesPlayed_9ball: 0,
        matchesWon_9ball: 0,
        matchesLost_9ball: 0,
        winRate_9ball: 0,

        racklessSets_8ball: 0,
        racklessSets_9ball: 0,

        breakAndRuns_8ball: 0,
        rackAndRuns_8ball: 0,
        breakAndRuns_9ball: 0,
        rackAndRuns_9ball: 0,
        winZips_9ball: 0,
        nineOnSnaps_9ball: 0,
    };
}

function getBreakpointLevel(rating: number): number {
    let level = 1;
    if (rating < 200) {
        // level 1: 0-199. Map 100->1.5? Or just 1.0? Let's just return 1.0 for very low.
        level = 1.0;
    } else if (rating < 300) {
        // 200-299 -> 2.0 - 2.9
        level = 2 + (rating - 200) / 100;
    } else if (rating < 400) {
        // 300-399 -> 3.0 - 3.9
        level = 3 + (rating - 300) / 100;
    } else if (rating < 500) {
        // 400-499 -> 4.0 - 4.9
        level = 4 + (rating - 400) / 100;
    } else if (rating < 550) {
        // 500-549 -> 5.0 - 5.9 (Width 50)
        level = 5 + (rating - 500) / 50;
    } else if (rating < 600) {
        // 550-599 -> 6.0 - 6.9 (Width 50)
        level = 6 + (rating - 550) / 50;
    } else if (rating < 650) {
        // 600-649 -> 7.0 - 7.9 (Width 50)
        level = 7 + (rating - 600) / 50;
    } else if (rating < 700) {
        // 650-699 -> 8.0 - 8.9 (Width 50)
        level = 8 + (rating - 650) / 50;
    } else if (rating < 800) {
        // 700-799 -> 9.0 - 9.9 (Width 100)
        level = 9 + (rating - 700) / 100;
    } else {
        // 800+ -> 10.0+
        // Assuming 100 points per level after 10?
        level = 10 + (rating - 800) / 100;
    }
    // Round to 1 decimal place
    return Math.round(level * 10) / 10;
}

function calculateEloChange(playerRating: number, opponentRating: number, isWin: boolean): number {
    const K_WIN = 30; // Bonus for winning (easier to move up)
    const K_LOSS = 15; // Mitigation for losing (harder to move down)
    const K = isWin ? K_WIN : K_LOSS;

    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = isWin ? 1 : 0;

    return Math.round(K * (actualScore - expectedScore));
}

function aggregateMatchStats(stats: PlayerStats, match: any, playerId: string, games: any[]) {
    stats.matchesPlayed++;
    const isP1 = match.player1_id === playerId;
    // Fix: Sum points explicitly from columns as current_points can be unreliable
    // Ensure casting to Number to prevent string concatenation/comparison bugs
    const p1Points = (Number(match.points_8ball_p1) || 0) + (Number(match.points_9ball_p1) || 0);
    const p2Points = (Number(match.points_8ball_p2) || 0) + (Number(match.points_9ball_p2) || 0);
    const points = isP1 ? p1Points : p2Points;

    stats.totalPoints += points;
    // NEW LOGIC: Calculate W-L based on "Sets" (8-ball and 9-ball separately)
    // Filter games for this match
    const matchGames = games.filter(g => g.match_id === match.id);

    // Calculate 8-ball and 9-ball points for this player and opponent
    let p8_points = 0;
    let opp8_points = 0;
    let p9_points = 0;
    let opp9_points = 0;

    let has8Ball = false;
    let has9Ball = false;

    matchGames.forEach(g => {
        // Only count if there is a winner
        if (g.winner_id) {
            const isPlayerWinner = g.winner_id === playerId;
            if (g.game_type === '8ball') {
                has8Ball = true;
                if (isPlayerWinner) p8_points++; else opp8_points++;
            } else if (g.game_type === '9ball') {
                has9Ball = true;
                if (isPlayerWinner) {
                    p9_points++;
                } else {
                    opp9_points++;
                }
            }
        } else {
            // Game exists but no winner (unplayed/unscored)
            // Should we set has8Ball/has9Ball to true? 
            // If we do, matchesPlayed increments. 
            // If the whole match is empty games, matchesPlayed should probably NOT increment.
            // So we leave has8Ball/has9Ball false here unless a valid game is found.

            // However, we need to respect game_type to know "what set it was" 
            // but if no points scored, maybe it doesn't count as played?
            // Let's stick to: only "active" games count.
            if (g.game_type === '8ball') {
                // Check if it's at least started? 
                // We will simply do nothing here.
            }
        }
    });

    // SUPPLEMENT: Check Match-Level columns if Games detection missed a set (e.g. Legacy or Split Source)
    if (!has8Ball) {
        const p1_8 = Number(match.points_8ball_p1) || 0;
        const p2_8 = Number(match.points_8ball_p2) || 0;
        const status8 = match.status_8ball;
        if (status8 === 'finalized' || match.is_forfeit || p1_8 > 0 || p2_8 > 0 || match.winner_id_8ball || match.winner_id) {
            has8Ball = true;
        }
    }

    if (!has9Ball) {
        const p1_9 = Number(match.points_9ball_p1) || 0;
        const p2_9 = Number(match.points_9ball_p2) || 0;
        const status9 = match.status_9ball;
        if (status9 === 'finalized' || match.is_forfeit || p1_9 > 0 || p2_9 > 0 || match.winner_id_9ball || match.winner_id) {
            has9Ball = true;
        }
    }

    // CALCULATE 8-BALL STATS
    if (has8Ball) {
        stats.matchesPlayed_8ball++;
        const p1_8 = Number(match.points_8ball_p1) || 0;
        const p2_8 = Number(match.points_8ball_p2) || 0;
        const myPoints8 = isP1 ? p1_8 : p2_8;
        const oppPoints8 = isP1 ? p2_8 : p1_8;

        let isWin = false;
        let isLoss = false;

        if (myPoints8 > oppPoints8) isWin = true;
        else if (myPoints8 < oppPoints8) isLoss = true;
        else {
            // Tie-break checks
            if (match.winner_id_8ball === playerId) isWin = true;
            else if (match.winner_id_8ball && match.winner_id_8ball !== playerId) isLoss = true;
            else if (match.winner_id === playerId) isWin = true;
            else if (match.winner_id && match.winner_id !== playerId) isLoss = true;
        }

        if (isWin) {
            stats.matchesWon++;
            stats.matchesWon_8ball++;
            if (oppPoints8 === 0) stats.racklessSets_8ball++;
        } else if (isLoss) {
            stats.matchesLost++;
            stats.matchesLost_8ball++;
        }
    }

    // CALCULATE 9-BALL STATS
    if (has9Ball) {
        stats.matchesPlayed_9ball++;
        const p1_9 = Number(match.points_9ball_p1) || 0;
        const p2_9 = Number(match.points_9ball_p2) || 0;
        const myPoints9 = isP1 ? p1_9 : p2_9;
        const oppPoints9 = isP1 ? p2_9 : p1_9;

        let isWin = false;
        let isLoss = false;

        if (myPoints9 > oppPoints9) isWin = true;
        else if (myPoints9 < oppPoints9) isLoss = true;
        else {
            // Tie-break checks
            if (match.winner_id_9ball === playerId) isWin = true;
            else if (match.winner_id_9ball && match.winner_id_9ball !== playerId) isLoss = true;
            else if (match.winner_id === playerId) isWin = true;
            else if (match.winner_id && match.winner_id !== playerId) isLoss = true;
        }

        if (isWin) {
            stats.matchesWon++;
            stats.matchesWon_9ball++;
            if (oppPoints9 === 0) stats.racklessSets_9ball++;
        } else if (isLoss) {
            stats.matchesLost++;
            stats.matchesLost_9ball++;
        }
    }

    // Note: matchesPlayed is simpler. Does one fixture count as 1 or 2 matches played?
    // User said "1-0 in 8ball and 0-1 in 9ball".
    // This implies 2 "Matches" (Sets) played.
    // So we should increment matchesPlayed for each set participated in.
    // currently stats.matchesPlayed++ is at top. We should adjust it.

    // Reset matchesPlayed increment from line 58 and recalc based on sets
    // Reset matchesPlayed increment
    stats.matchesPlayed--;
    if (has8Ball) stats.matchesPlayed++;
    if (has9Ball) stats.matchesPlayed++;

    // Total stats.totalPoints is still fine as sum of all points.

    /* ORIGINAL LOGIC REMOVED
    if (isWinner) {
        stats.matchesWon++;
    } else {
        stats.matchesLost++;
    } 
    */

    matchGames.forEach(game => {
        // Detailed stats are usually attributed to the winner of the game/rack
        // Except maybe 9 on snap which is specific? assuming winner gets credit.
        if (game.winner_id === playerId) {
            if (game.game_type === '8ball') {
                if (game.is_break_and_run) stats.breakAndRuns_8ball++;
                if (game.is_rack_and_run) stats.rackAndRuns_8ball++;
            } else if (game.game_type === '9ball') {
                if (game.is_break_and_run) stats.breakAndRuns_9ball++;
                if (game.is_rack_and_run) stats.rackAndRuns_9ball++;
                if (game.is_win_zip) stats.winZips_9ball++;
                if (game.is_9_on_snap) stats.nineOnSnaps_9ball++;
            }
        }
    });

    return stats;
}

export async function getSessionStats(sessionId: string): Promise<PlayerStats[]> {
    const supabase = createAdminClient();

    // 1. Fetch Matches with Player Ratings
    const { data: matches } = await supabase
        .from("matches")
        .select("id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, is_forfeit, player1:player1_id(full_name, fargo_rating), player2:player2_id(full_name, fargo_rating)")
        .eq("league_id", sessionId)
        .or("status.eq.finalized,winner_id.not.is.null") // Accept finalized OR valid winner
        .order("scheduled_date", { ascending: true });

    if (!matches || matches.length === 0) return [];

    // 2. Fetch Games for these matches (for detailed stats)
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
            // console.log(`Init P1: ${match.player1_id} -> ${p1Name}`);
            statsMap.set(match.player1_id, getInitStats(match.player1_id, p1Name || "Unknown"));
        }
        aggregateMatchStats(statsMap.get(match.player1_id)!, match, match.player1_id, allGames);

        // Player 2
        if (!statsMap.has(match.player2_id)) {
            const p2Data = match.player2;
            const p2Name = Array.isArray(p2Data) ? p2Data[0]?.full_name : (p2Data as any)?.full_name;
            // console.log(`Init P2: ${match.player2_id} -> ${p2Name}`);
            statsMap.set(match.player2_id, getInitStats(match.player2_id, p2Name || "Unknown"));
        }
        aggregateMatchStats(statsMap.get(match.player2_id)!, match, match.player2_id, allGames);
    });

    // Calculate Ratings for Session
    const ratings = new Map<string, number>();
    // Initialize everyone at 500 (or existing rating if we fetched it, but user said "Everyone starts at 5")
    // Note: If we want to persist rating across sessions, we should fetch Profile rating.
    // But per request "Everyone starts at 5", we init to 500.
    matches.forEach(m => {
        if (!ratings.has(m.player1_id)) ratings.set(m.player1_id, 500);
        if (!ratings.has(m.player2_id)) ratings.set(m.player2_id, 500);
    });

    matches.forEach(match => {
        const p1Rating = ratings.get(match.player1_id) || 500;
        const p2Rating = ratings.get(match.player2_id) || 500;

        let isP1Win = false;
        let isDraw = false;

        const isP1 = true; // Relative to P1

        if (match.winner_id) {
            if (match.winner_id === match.player1_id) isP1Win = true;
            else isP1Win = false;
        } else {
            // Fallback logic
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

    // Calculate Averages and Assign Rating
    const statsArray = Array.from(statsMap.values()).map(stat => {
        stat.pointsPerMatch = stat.matchesPlayed > 0 ? (stat.totalPoints / stat.matchesPlayed).toFixed(2) : "0.00";
        stat.winRate = stat.matchesPlayed > 0 ? Math.round((stat.matchesWon / stat.matchesPlayed) * 100) : 0;

        stat.winRate_8ball = stat.matchesPlayed_8ball > 0 ? Math.round((stat.matchesWon_8ball / stat.matchesPlayed_8ball) * 100) : 0;
        stat.winRate_9ball = stat.matchesPlayed_9ball > 0 ? Math.round((stat.matchesWon_9ball / stat.matchesPlayed_9ball) * 100) : 0;

        // Assign Calculated Breakpoint
        const finalRating = ratings.get(stat.playerId) || 500;
        stat.breakPoint = getBreakpointLevel(finalRating);

        return stat;
    });

    return statsArray;
}

export async function getSessionLeaderboard(sessionId: string, limit: number = 10) {
    const stats = await getSessionStats(sessionId);
    // Sort by win rate, then points per match
    const sortedStats = stats.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return parseFloat(b.pointsPerMatch) - parseFloat(a.pointsPerMatch);
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
    const { data: matches } = await supabase
        .from("matches")
        .select("id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, is_forfeit")
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .or("status.eq.finalized,winner_id.not.is.null");

    if (!matches || matches.length === 0) {
        return {
            matchesPlayed: 0,
            matchesWon: 0,
            matchesLost: 0,
            totalPoints: 0,
            pointsPerMatch: "0.00",
            winRate: 0,
            matchesPlayed_8ball: 0,
            matchesWon_8ball: 0,
            matchesLost_8ball: 0,
            winRate_8ball: 0,
            matchesPlayed_9ball: 0,
            matchesWon_9ball: 0,
            matchesLost_9ball: 0,
            winRate_9ball: 0,
            breakAndRuns_8ball: 0,
            rackAndRuns_8ball: 0,
            breakAndRuns_9ball: 0,
            rackAndRuns_9ball: 0,
            winZips_9ball: 0,
            nineOnSnaps_9ball: 0,
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
    stats.breakPoint = getBreakpointLevel(currentRating);

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
    const { data: matches } = await supabase
        .from("matches")
        .select("id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, is_forfeit")
        .eq("league_id", sessionId)
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .or("status.eq.finalized,winner_id.not.is.null");

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



    // Fetch Profile Rating
    const { data: profile } = await supabase.from("profiles").select("fargo_rating, breakpoint_rating").eq("id", playerId).single();
    const currentRating = profile?.breakpoint_rating || 500;

    const stats = getInitStats(playerId, "Player");
    stats.breakPoint = getBreakpointLevel(currentRating);

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
            rating: getBreakpointLevel(currentRating)
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
        .select("id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, status_8ball, status_9ball, winner_id_8ball, winner_id_9ball, is_forfeit, player1:player1_id(full_name, fargo_rating), player2:player2_id(full_name, fargo_rating), league_id, leagues!inner(parent_league_id)")
        .eq("leagues.parent_league_id", leagueId) // Assuming leagueId is the Parent Key
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
            const p1Rating = Array.isArray(p1Data) ? p1Data[0]?.fargo_rating : (p1Data as any)?.fargo_rating;

            const p1Stats = getInitStats(match.player1_id, p1Name || "Unknown");
            p1Stats.breakPoint = getBreakpointLevel(p1Rating || 500);
            statsMap.set(match.player1_id, p1Stats);
        }
        aggregateMatchStats(statsMap.get(match.player1_id)!, match, match.player1_id, allGames);

        // Player 2
        if (!statsMap.has(match.player2_id)) {
            const p2Data = match.player2;
            const p2Name = Array.isArray(p2Data) ? p2Data[0]?.full_name : (p2Data as any)?.full_name;
            const p2Rating = Array.isArray(p2Data) ? p2Data[0]?.fargo_rating : (p2Data as any)?.fargo_rating;

            const p2Stats = getInitStats(match.player2_id, p2Name || "Unknown");
            p2Stats.breakPoint = getBreakpointLevel(p2Rating || 500);
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

    // Sort by Win Rate (desc), then Total Points (desc), then Matches Won (desc)
    statsArray.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return b.matchesWon - a.matchesWon;
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

    if (!matches || matches.length === 0) {
        return getInitStats(playerId, "Player");
    }

    // 3. Fetch Games
    const matchIds = matches.map(m => m.id);
    const { data: games } = await supabase
        .from("games")
        .select("*")
        .in("match_id", matchIds);

    const allGames = games || [];
    const stats = getInitStats(playerId, "Player");

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
            p1Stats.breakPoint = getBreakpointLevel(p1Rating || 500);
            statsMap.set(match.player1_id, p1Stats);
        }
        aggregateMatchStats(statsMap.get(match.player1_id)!, match, match.player1_id, allGames);

        // Player 2
        if (!statsMap.has(match.player2_id)) {
            const p2Data = match.player2;
            const p2Name = Array.isArray(p2Data) ? p2Data[0]?.full_name : (p2Data as any)?.full_name;
            const p2Rating = Array.isArray(p2Data) ? p2Data[0]?.breakpoint_rating : (p2Data as any)?.breakpoint_rating;

            const p2Stats = getInitStats(match.player2_id, p2Name || "Unknown");
            p2Stats.breakPoint = getBreakpointLevel(p2Rating || 500);
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
