'use server'

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function submitGameScore(
    matchId: string,
    leagueId: string,
    gameNumber: number,
    winnerId: string,
    p1Score: number,
    p2Score: number,
    gameType: '8ball' | '9ball',
    stats?: {
        isBreakAndRun?: boolean;
        isRackAndRun?: boolean;
        isEarly8?: boolean;
        is8WrongPocket?: boolean;
        isWinZip?: boolean;
        is9OnSnap?: boolean;
    },
    ballMapping?: Record<string, string | null>
) {
    const supabase = createAdminClient();
    console.log("submitGameScore called with:", { matchId, leagueId, gameNumber, winnerId, p1Score, p2Score, gameType, stats, ballMapping });

    // 1. Fetch current match state
    const { data: match } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

    if (!match) return { error: "Match not found" };

    // 2. Calculate points (Use provided scores directly)
    // For 8-ball, we might still want to enforce the 10-point rule if we rely on the UI to send it?
    // But let's trust the UI to send the correct values.
    // The UI for 8-ball sends "Loser Score", and implies Winner=10.
    // We should update the UI to send explicit scores for 8-ball too, or handle it here.
    // Let's handle it here for backward compatibility or ease:
    // Actually, let's just use the passed scores. The UI will calculate them.

    const p1Points = p1Score;
    const p2Points = p2Score;

    // 3. Determine Context (8-ball vs 9-ball)
    const currentP1Total = gameType === '8ball' ? (match.points_8ball_p1 || 0) : (match.points_9ball_p1 || 0);
    const currentP2Total = gameType === '8ball' ? (match.points_8ball_p2 || 0) : (match.points_9ball_p2 || 0);
    const raceP1 = gameType === '8ball' ? match.race_8ball_p1 : match.race_9ball_p1;
    const raceP2 = gameType === '8ball' ? match.race_8ball_p2 : match.race_9ball_p2;

    const newP1Total = currentP1Total + p1Points;
    const newP2Total = currentP2Total + p2Points;

    // 4. Check for Sub-Match Winner
    let subMatchStatus = "in_progress";
    let subMatchWinnerId = null;

    console.log(`Checking Finalization: P1=${newP1Total}/${raceP1}, P2=${newP2Total}/${raceP2}`);

    if (newP1Total >= raceP1 || newP2Total >= raceP2) {
        subMatchStatus = "finalized";
        console.log("Match Finalized!");

        // Determine Winner Logic
        if (newP1Total >= raceP1 && newP2Total >= raceP2) {
            // Both reached goal (e.g. finish the rack scenario)
            // Winner is the winner of the FINAL game (this game)
            subMatchWinnerId = winnerId;
        } else if (newP1Total >= raceP1) {
            subMatchWinnerId = match.player1_id;
        } else {
            subMatchWinnerId = match.player2_id;
        }
    }

    // 5. Insert Game Record
    const { error: gameError } = await supabase.from("games").insert({
        match_id: matchId,
        game_number: gameNumber,
        score_p1: p1Points,
        score_p2: p2Points,
        submitted_by: match.operator_id,
        verified_at: new Date().toISOString(),
        game_type: gameType,
        winner_id: winnerId,
        is_break_and_run: stats?.isBreakAndRun || false,
        is_rack_and_run: stats?.isRackAndRun || false,
        is_early_8: stats?.isEarly8 || false,
        is_8_wrong_pocket: stats?.is8WrongPocket || false,
        is_win_zip: stats?.isWinZip || false,
        is_9_on_snap: stats?.is9OnSnap || false,
        ball_mapping: ballMapping ? ballMapping : null,
        dead_balls_count: ballMapping ? Object.values(ballMapping).filter(v => v === 'dead').length : 0
    });

    if (gameError) {
        console.error("Error inserting game:", gameError);
        return { error: "Failed to save game" };
    }
    console.log("Game inserted successfully");

    // 6. Update Match
    const updates: any = {};
    if (gameType === '8ball') {
        updates.points_8ball_p1 = newP1Total;
        updates.points_8ball_p2 = newP2Total;
        updates.status_8ball = subMatchStatus;
        if (subMatchStatus === 'finalized') updates.ended_at_8ball = new Date().toISOString();
        if (subMatchWinnerId) updates.winner_id_8ball = subMatchWinnerId;

        // Update legacy columns
        updates.current_points_p1 = newP1Total;
        updates.score_8ball_p1 = newP1Total;
        updates.score_8ball_p2 = newP2Total;
    } else {
        updates.points_9ball_p1 = newP1Total;
        updates.points_9ball_p2 = newP2Total;
        updates.status_9ball = subMatchStatus;
        if (subMatchStatus === 'finalized') updates.ended_at_9ball = new Date().toISOString();
        if (subMatchWinnerId) updates.winner_id_9ball = subMatchWinnerId;

        updates.score_9ball_p1 = newP1Total;
        updates.score_9ball_p2 = newP2Total;
    }

    // Check if BOTH are finalized to finalize the whole match?
    const is8BallFinalized = gameType === '8ball' ? subMatchStatus === 'finalized' : match.status_8ball === 'finalized';
    const is9BallFinalized = gameType === '9ball' ? subMatchStatus === 'finalized' : match.status_9ball === 'finalized';

    if (is8BallFinalized && is9BallFinalized) {
        updates.status = 'finalized';

        // Calculate overall winner based on total points
        const p1Total = (updates.points_8ball_p1 || match.points_8ball_p1 || 0) + (updates.points_9ball_p1 || match.points_9ball_p1 || 0);
        const p2Total = (updates.points_8ball_p2 || match.points_8ball_p2 || 0) + (updates.points_9ball_p2 || match.points_9ball_p2 || 0);

        if (p1Total > p2Total) {
            updates.winner_id = match.player1_id;
        } else if (p2Total > p1Total) {
            updates.winner_id = match.player2_id;
        } else {
            // Tie? Leave null or handle tie logic. 
            // For now, let's leave it null if it's a perfect tie, but that might break "Win Rate".
            // Maybe ties count as 0.5 win?
            // Let's assume ties are rare or handled elsewhere, but for now just don't set winner_id if tie.
        }
    }

    const { error: matchError } = await supabase
        .from("matches")
        .update(updates)
        .eq("id", matchId);

    if (matchError) {
        console.error("Error updating match:", matchError);
        return { error: "Failed to update match" };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}/matches/${matchId}/score`);
}

export async function updateGameScore(
    gameId: string,
    matchId: string,
    leagueId: string,
    winnerId: string,
    p1Score: number,
    p2Score: number,
    gameType: '8ball' | '9ball',
    stats?: {
        isBreakAndRun?: boolean;
        isRackAndRun?: boolean;
        isEarly8?: boolean;
        is8WrongPocket?: boolean;
        isWinZip?: boolean;
        is9OnSnap?: boolean;
    },
    ballMapping?: Record<string, string | null>
) {
    const supabase = createAdminClient();

    // 1. Update the specific game
    const { error: updateError } = await supabase
        .from("games")
        .update({
            score_p1: p1Score,
            score_p2: p2Score,
            winner_id: winnerId,
            is_break_and_run: stats?.isBreakAndRun || false,
            is_rack_and_run: stats?.isRackAndRun || false,
            is_early_8: stats?.isEarly8 || false,
            is_8_wrong_pocket: stats?.is8WrongPocket || false,
            is_win_zip: stats?.isWinZip || false,
            is_9_on_snap: stats?.is9OnSnap || false,
            ball_mapping: ballMapping ? ballMapping : null,
            dead_balls_count: ballMapping ? Object.values(ballMapping).filter(v => v === 'dead').length : 0,
            verified_at: new Date().toISOString()
        })
        .eq("id", gameId);

    if (updateError) {
        console.error("Error updating game:", updateError);
        return { error: "Failed to update game" };
    }

    // 2. Fetch Match Data to get Races
    const { data: match } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

    if (!match) return { error: "Match not found" };

    // 3. Recalculate Totals
    // Fetch ALL games for this match
    const { data: allGames } = await supabase
        .from("games")
        .select("*")
        .eq("match_id", matchId);

    if (!allGames) return { error: "Failed to fetch games for recalculation" };

    // Filter by type for sub-match totals
    const typeGames = allGames.filter(g => g.game_type === gameType || (!g.game_type && gameType === '8ball'));

    const newP1Total = typeGames.reduce((sum, g) => sum + (g.score_p1 || 0), 0);
    const newP2Total = typeGames.reduce((sum, g) => sum + (g.score_p2 || 0), 0);

    const raceP1 = gameType === '8ball' ? match.race_8ball_p1 : match.race_9ball_p1;
    const raceP2 = gameType === '8ball' ? match.race_8ball_p2 : match.race_9ball_p2;

    // 4. Determine Status
    let subMatchStatus = "in_progress";
    let subMatchWinnerId = null;

    if (newP1Total >= raceP1 || newP2Total >= raceP2) {
        subMatchStatus = "finalized";
        // Logic: Who reached race?
        if (newP1Total >= raceP1 && newP2Total >= raceP2) {
            // If both, let's look at the LAST game's winner, or just whoever has more?
            // Usually it's whoever reached it first, but we are editing history.
            // Simple logic: If P1 >= Race, P1 wins. If both, maybe tie or check max?
            // In pool, usually you play TO a score.
            if (newP1Total > newP2Total) subMatchWinnerId = match.player1_id;
            else if (newP2Total > newP1Total) subMatchWinnerId = match.player2_id;
            else subMatchWinnerId = winnerId; // Fallback to current game winner
        } else if (newP1Total >= raceP1) {
            subMatchWinnerId = match.player1_id;
        } else {
            subMatchWinnerId = match.player2_id;
        }
    }

    // 5. Update Match
    const updates: any = {};
    if (gameType === '8ball') {
        updates.points_8ball_p1 = newP1Total;
        updates.points_8ball_p2 = newP2Total;
        updates.status_8ball = subMatchStatus;
        updates.winner_id_8ball = subMatchWinnerId; // Null if in_progress

        // Legacy
        updates.current_points_p1 = newP1Total;
        updates.score_8ball_p1 = newP1Total;
        updates.score_8ball_p2 = newP2Total;
    } else {
        updates.points_9ball_p1 = newP1Total;
        updates.points_9ball_p2 = newP2Total;
        updates.status_9ball = subMatchStatus;
        updates.winner_id_9ball = subMatchWinnerId;

        updates.score_9ball_p1 = newP1Total;
        updates.score_9ball_p2 = newP2Total;
    }

    // Check Global Finalization
    // We need to check the OTHER game type status too.
    // If we are editing 8ball, we check 9ball status from DB (match object).
    const is8BallFinalized = gameType === '8ball' ? subMatchStatus === 'finalized' : match.status_8ball === 'finalized';
    const is9BallFinalized = gameType === '9ball' ? subMatchStatus === 'finalized' : match.status_9ball === 'finalized';

    if (is8BallFinalized && is9BallFinalized) {
        updates.status = 'finalized';
        // Total Winner
        const p1Total = (updates.points_8ball_p1 ?? match.points_8ball_p1 ?? 0) + (updates.points_9ball_p1 ?? match.points_9ball_p1 ?? 0);
        const p2Total = (updates.points_8ball_p2 ?? match.points_8ball_p2 ?? 0) + (updates.points_9ball_p2 ?? match.points_9ball_p2 ?? 0);

        if (p1Total > p2Total) updates.winner_id = match.player1_id;
        else if (p2Total > p1Total) updates.winner_id = match.player2_id;
    } else {
        // If we edited a game and it UN-finalized a match (e.g. reduced score below race), we should revert status
        updates.status = 'scheduled'; // or in_progress? 
        // Logic: if verified_at exists, it's at least in progress.
        updates.status = 'in_progress';
        updates.winner_id = null;
    }

    const { error: matchUpdateError } = await supabase
        .from("matches")
        .update(updates)
        .eq("id", matchId);

    if (matchUpdateError) {
        console.error("Error updating match totals:", matchUpdateError);
        return { error: "Failed to update match totals" };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}/matches/${matchId}/score`);
}

export async function startMatch(matchId: string, leagueId: string) {
    const supabase = createAdminClient();

    // Check if running already
    const { data: match } = await supabase.from('matches').select('started_at').eq('id', matchId).single();
    if (match?.started_at) return { success: true };

    const { error } = await supabase
        .from('matches')
        .update({ started_at: new Date().toISOString() })
        .eq('id', matchId);

    if (error) {
        console.error("Error starting match:", error);
        return { error: "Failed to start match" };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}/matches/${matchId}/score`);
    return { success: true };
}

export async function submitMatch(matchId: string, leagueId: string) {
    const supabase = createAdminClient();

    const { data: match } = await supabase.from('matches').select('started_at').eq('id', matchId).single();
    if (!match?.started_at) return { error: "Match hasn't started" };

    const now = new Date();
    const startedAt = new Date(match.started_at);
    // Ensure positive duration
    let durationSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);
    if (durationSeconds < 0) durationSeconds = 0;

    const { error } = await supabase
        .from('matches')
        .update({
            submitted_at: now.toISOString(),
            duration_seconds: durationSeconds,
            status: 'finalized' // Global lock
        })
        .eq('id', matchId);

    if (error) {
        console.error("Error submitting match:", error);
        return { error: "Failed to submit match" };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}/matches/${matchId}/score`);
    return { success: true };
}

export async function forfeitMatch(matchId: string, leagueId: string, forfeitedByPlayerId: string, opponentId: string) {
    const supabase = createAdminClient();

    const { data: match } = await supabase.from('matches').select('started_at, status').eq('id', matchId).single();

    if (!match) return { error: "Match not found" };

    const now = new Date();
    let durationSeconds = 0;
    if (match.started_at) {
        durationSeconds = Math.round((now.getTime() - new Date(match.started_at).getTime()) / 1000);
        if (durationSeconds < 0) durationSeconds = 0;
    }

    const { error } = await supabase
        .from('matches')
        .update({
            status: 'finalized',
            winner_id: opponentId,
            is_forfeit: true,
            forfeited_by: forfeitedByPlayerId,
            submitted_at: now.toISOString(),
            duration_seconds: durationSeconds
        })
        .eq('id', matchId);

    if (error) {
        console.error("Error forfeiting match:", error);
        return { error: "Failed to forfeit match" };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}/matches/${matchId}/score`);
    return { success: true };
}

