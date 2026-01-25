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

    breakPoint?: number;
    // New: Confidence Metric
    totalRacksPlayed: number;

    // Breakdown Stats
    matchesPlayed_8ball: number;
    matchesWon_8ball: number;
    matchesLost_8ball: number;
    winRate_8ball: number;
    racksWon_8ball: number;
    racksPlayed_8ball: number;

    matchesPlayed_9ball: number;
    matchesWon_9ball: number;
    matchesLost_9ball: number;
    winRate_9ball: number;
    racksWon_9ball: number;
    racksPlayed_9ball: number;

    racklessSets_8ball: number;
    racklessSets_9ball: number;

    // Detailed Stats
    breakAndRuns_8ball: number;
    rackAndRuns_8ball: number;
    breakAndRuns_9ball: number;
    rackAndRuns_9ball: number;
    nineOnSnaps_9ball: number;

    // Formatted / Derived Stats for Display
    display_setWinRate: string;
    display_setRecord: string;
    display_setWinRate8: string;
    display_setRecord8: string;
    display_setWinRate9: string;
    display_setRecord9: string;
    display_shutouts: number;

    display_gameWinRate: string;
    display_gameRecord: string;
    display_gameWinRate8: string;
    display_gameRecord8: string;
    display_gameWinRate9: string;
    display_gameRecord9: string;
    confidenceScore: number;
};

export function getInitStats(playerId: string, playerName: string): PlayerStats {
    return {
        playerId,
        playerName,
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
        nineOnSnaps_9ball: 0,

        display_setWinRate: "0%",
        display_setRecord: "0-0",
        display_setWinRate8: "0%",
        display_setRecord8: "0-0",
        display_setWinRate9: "0%",
        display_setRecord9: "0-0",
        display_shutouts: 0,

        display_gameWinRate: "0%",
        display_gameRecord: "0-0",
        display_gameWinRate8: "0%",
        display_gameRecord8: "0-0",
        display_gameWinRate9: "0%",
        display_gameRecord9: "0-0",
        confidenceScore: 0
    };
}

export function getBreakpointLevel(rating: number): string {
    if (!rating) return "5.0";
    // Mobile Logic: Move decimal 2 places to left and display to tenths place (Truncated)
    const val = Math.floor(rating / 10) / 10;
    return val.toFixed(1);
}

export function calculateEloChange(playerRating: number, opponentRating: number, isWin: boolean): number {
    const K_WIN = 30; // Bonus for winning (easier to move up)
    const K_LOSS = 15; // Mitigation for losing (harder to move down)
    const K = isWin ? K_WIN : K_LOSS;

    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = isWin ? 1 : 0;

    return Math.round(K * (actualScore - expectedScore));
}

export function aggregateMatchStats(stats: PlayerStats, match: any, playerId: string, games: any[]) {
    stats.matchesPlayed++;
    const isP1 = match.player1_id === playerId;

    // Sum points explicitly
    const p1Points = (Number(match.points_8ball_p1) || 0) + (Number(match.points_9ball_p1) || 0);
    const p2Points = (Number(match.points_8ball_p2) || 0) + (Number(match.points_9ball_p2) || 0);
    const points = isP1 ? p1Points : p2Points;

    stats.totalPoints += points;
    // stats.totalRacksPlayed will be accumulated in the 8ball/9ball specific blocks using game counts now
    // stats.totalRacksPlayed += (p1Points + p2Points); // REMOVED: This was summing points

    const matchGames = games.filter(g => g.match_id === match.id);

    let p8_points = 0;
    let opp8_points = 0;
    let p9_points = 0;
    let opp9_points = 0;

    let has8Ball = false;
    let has9Ball = false;

    matchGames.forEach(g => {
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
        }
    });

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

    if (has8Ball) {
        stats.matchesPlayed_8ball++;
        // Use Games for Rack Counts (Racks Won/Lost)
        let myRacks = 0;
        let oppRacks = 0;

        matchGames.forEach(g => {
            if (g.game_type === '8ball') {
                if (g.winner_id === playerId) myRacks++;
                else if (g.winner_id) oppRacks++;
            }
        });

        stats.racksWon_8ball += myRacks;
        stats.racksPlayed_8ball += (myRacks + oppRacks);
        stats.totalRacksPlayed += (myRacks + oppRacks);

        // Calculate Set Win/Loss based on Match Winner field or Points (fallback)
        let isWin = false;
        let isLoss = false;

        if (match.winner_id_8ball === playerId) isWin = true;
        else if (match.winner_id_8ball && match.winner_id_8ball !== playerId) isLoss = true;
        else if (match.winner_id === playerId) isWin = true;
        else if (match.winner_id && match.winner_id !== playerId) isLoss = true;
        else {
            // Fallback to points if no winner set
            const p1_8 = Number(match.points_8ball_p1) || 0;
            const p2_8 = Number(match.points_8ball_p2) || 0;
            const myPoints8 = isP1 ? p1_8 : p2_8;
            const oppPoints8 = isP1 ? p2_8 : p1_8;
            if (myPoints8 > oppPoints8) isWin = true;
            else if (myPoints8 < oppPoints8) isLoss = true;
        }

        if (isWin) {
            stats.matchesWon++;
            stats.matchesWon_8ball++;
            // Rackless set = Opponent won 0 Racks
            if (oppRacks === 0 && myRacks > 0) stats.racklessSets_8ball++;
        } else if (isLoss) {
            stats.matchesLost++;
            stats.matchesLost_8ball++;
        }
    }

    if (has9Ball) {
        stats.matchesPlayed_9ball++;
        // Use Games for Rack Counts
        let myRacks = 0;
        let oppRacks = 0;

        matchGames.forEach(g => {
            // 9-Ball games (or empty type if we assume mixed? No, strictly type check)
            if (g.game_type === '9ball') {
                if (g.winner_id === playerId) myRacks++;
                else if (g.winner_id) oppRacks++;
            }
        });

        stats.racksWon_9ball += myRacks;
        stats.racksPlayed_9ball += (myRacks + oppRacks);
        stats.totalRacksPlayed += (myRacks + oppRacks);

        let isWin = false;
        let isLoss = false;

        if (match.winner_id_9ball === playerId) isWin = true;
        else if (match.winner_id_9ball && match.winner_id_9ball !== playerId) isLoss = true;
        else if (match.winner_id === playerId) isWin = true;
        else if (match.winner_id && match.winner_id !== playerId) isLoss = true;
        else {
            const p1_9 = Number(match.points_9ball_p1) || 0;
            const p2_9 = Number(match.points_9ball_p2) || 0;
            const myPoints9 = isP1 ? p1_9 : p2_9;
            const oppPoints9 = isP1 ? p2_9 : p1_9;
            if (myPoints9 > oppPoints9) isWin = true;
            else if (myPoints9 < oppPoints9) isLoss = true;
        }

        if (isWin) {
            stats.matchesWon++;
            stats.matchesWon_9ball++;
            if (oppRacks === 0 && myRacks > 0) stats.racklessSets_9ball++;
        } else if (isLoss) {
            stats.matchesLost++;
            stats.matchesLost_9ball++;
        }
    }

    stats.matchesPlayed--;
    if (has8Ball) stats.matchesPlayed++;
    if (has9Ball) stats.matchesPlayed++;

    matchGames.forEach(game => {
        if (game.winner_id === playerId) {
            if (game.game_type === '8ball') {
                if (game.is_break_and_run) stats.breakAndRuns_8ball++;
                if (game.is_rack_and_run) stats.rackAndRuns_8ball++;
            } else if (game.game_type === '9ball') {
                if (game.is_break_and_run) stats.breakAndRuns_9ball++;
                if (game.is_rack_and_run) stats.rackAndRuns_9ball++;
                if (game.is_9_on_snap) stats.nineOnSnaps_9ball++;
            }
        }
    });

    // Calculate Derived / Formatted Stats
    const formatPercent = (won: number, total: number) => total > 0 ? Math.round((won / total) * 100) + "%" : "0%";
    const formatRecord = (won: number, lost: number) => `${won}-${lost}`;

    stats.display_setWinRate = formatPercent(stats.matchesWon, stats.matchesPlayed);
    stats.display_setRecord = formatRecord(stats.matchesWon, stats.matchesLost);

    stats.display_setWinRate8 = formatPercent(stats.matchesWon_8ball, stats.matchesPlayed_8ball);
    stats.display_setRecord8 = formatRecord(stats.matchesWon_8ball, stats.matchesLost_8ball);

    stats.display_setWinRate9 = formatPercent(stats.matchesWon_9ball, stats.matchesPlayed_9ball);
    stats.display_setRecord9 = formatRecord(stats.matchesWon_9ball, stats.matchesLost_9ball);

    stats.display_shutouts = stats.racklessSets_8ball + stats.racklessSets_9ball; // Assuming rackless = shutout

    // Game (Rack) Stats
    const totalRacksWon = stats.racksWon_8ball + stats.racksWon_9ball;
    const totalRacksLost = stats.totalRacksPlayed - totalRacksWon;

    stats.display_gameWinRate = formatPercent(totalRacksWon, stats.totalRacksPlayed);
    stats.display_gameRecord = formatRecord(totalRacksWon, totalRacksLost);

    const racksLost8 = stats.racksPlayed_8ball - stats.racksWon_8ball;
    stats.display_gameWinRate8 = formatPercent(stats.racksWon_8ball, stats.racksPlayed_8ball);
    stats.display_gameRecord8 = formatRecord(stats.racksWon_8ball, racksLost8);

    const racksLost9 = stats.racksPlayed_9ball - stats.racksWon_9ball;
    stats.display_gameWinRate9 = formatPercent(stats.racksWon_9ball, stats.racksPlayed_9ball);
    stats.display_gameRecord9 = formatRecord(stats.racksWon_9ball, racksLost9);

    // Confidence Score Calculation (Simple)
    // 10 matches = 100% confidence
    stats.confidenceScore = Math.min(stats.matchesPlayed * 10, 100);

    return stats;
}
