'use server';

import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteTournament(tournamentId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    const supabase = await createClient();

    const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId);

    if (error) {
        console.error('Error deleting tournament:', error);
        throw new Error('Failed to delete tournament');
    }

    revalidatePath('/dashboard/tournaments');
}

export async function archiveTournament(tournamentId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    const supabase = await createClient();

    const { error } = await supabase
        .from('tournaments')
        .update({ status: 'archived' })
        .eq('id', tournamentId);

    if (error) {
        console.error('Error archiving tournament:', error);
        throw new Error('Failed to archive tournament');
    }

    revalidatePath('/dashboard/tournaments');
}

export async function advanceMatch(matchId: string, winnerId: string, score1: number, score2: number) {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    const supabase = await createClient();

    // 1. Fetch Match Details & Tournament Info
    const { data: match, error: fetchError } = await supabase
        .from('tournament_matches')
        .select(`
            *,
            tournament:tournaments(id, is_rated, game_type),
            p1:player1_id(id, player_id),
            p2:player2_id(id, player_id)
        `)
        .eq('id', matchId)
        .single();

    if (fetchError || !match) throw new Error('Match not found');

    // 2. Update Match Status
    const { error: updateError } = await supabase
        .from('tournament_matches')
        .update({
            winner_id: winnerId,
            score1,
            score2,
            status: 'completed'
        })
        .eq('id', matchId);

    if (updateError) throw updateError;

    // 3. Advance Winner
    const code = match.match_position_code; // e.g., WR1-1
    const parts = code.match(/([WL])R(\d+)-(\d+)/);

    if (parts) {
        const [_, side, roundStr, matchNumStr] = parts;
        const currentRound = parseInt(roundStr);
        const currentMatchNum = parseInt(matchNumStr);

        // Calculate Next Match (Single Elimination / Winners Bracket Logic)
        if (side === 'W') {
            const nextRound = currentRound + 1;
            const nextMatchNum = Math.ceil(currentMatchNum / 2);
            const nextMatchCode = `WR${nextRound}-${nextMatchNum}`;

            // Determine Slot (Player 1 or Player 2)
            // Match 1 -> Player 1, Match 2 -> Player 2
            const isPlayer1Slot = currentMatchNum % 2 !== 0;

            // Find Next Match
            const { data: nextMatch } = await supabase
                .from('tournament_matches')
                .select('id, player1_id, player2_id')
                .eq('tournament_id', match.tournament.id)
                .eq('match_position_code', nextMatchCode)
                .single();

            if (nextMatch) {
                const updatePayload: any = {};
                if (isPlayer1Slot) updatePayload.player1_id = winnerId;
                else updatePayload.player2_id = winnerId;

                // Check if match is now readable (both players present)
                const newP1 = isPlayer1Slot ? winnerId : nextMatch.player1_id;
                const newP2 = isPlayer1Slot ? nextMatch.player2_id : winnerId;

                if (newP1 && newP2) {
                    updatePayload.status = 'ready';
                }

                await supabase
                    .from('tournament_matches')
                    .update(updatePayload)
                    .eq('id', nextMatch.id);
            }
        }
    }

    // 4. SYNC TO RATED MATCHES (If Rated Tournament)
    const tournamentData = Array.isArray(match.tournament) ? match.tournament[0] : match.tournament;

    if (tournamentData?.is_rated) {
        // match.p1 and match.p2 are joined from 'tournament_participants' now (due to schema change).
        // The join in step 1 returns p1:player1_id(id, player_id) -> where inner player_id is the profile ID.

        const p1Data = Array.isArray(match.p1) ? match.p1[0] : match.p1;
        const p2Data = Array.isArray(match.p2) ? match.p2[0] : match.p2;

        // Extract Profile IDs (which are stored in player_id column of participants table)
        const p1ProfileId = p1Data?.player_id;
        const p2ProfileId = p2Data?.player_id;

        // Determine Winner Profile ID
        let winnerProfileId = null;
        if (winnerId === match.player1_id) winnerProfileId = p1ProfileId;
        if (winnerId === match.player2_id) winnerProfileId = p2ProfileId;

        // Only sync if both are real players (not guests/byes with no profile)
        if (p1ProfileId && p2ProfileId && winnerProfileId) {
            const gameType = tournamentData.game_type || '8ball';

            const insertPayload: any = {
                tournament_id: tournamentData.id,
                player1_id: p1ProfileId,
                player2_id: p2ProfileId,
                winner_id: winnerProfileId,
                status: 'finalized',
                created_at: new Date().toISOString()
            };

            if (gameType === '9ball') {
                insertPayload.score_9ball_p1 = score1;
                insertPayload.score_9ball_p2 = score2;
                insertPayload.points_9ball_p1 = score1;
                insertPayload.points_9ball_p2 = score2;
            } else {
                insertPayload.score_8ball_p1 = score1;
                insertPayload.score_8ball_p2 = score2;
                insertPayload.points_8ball_p1 = score1;
                insertPayload.points_8ball_p2 = score2;
            }

            const { error: syncError } = await supabase
                .from('matches')
                .insert(insertPayload);

            if (syncError) {
                console.error('Failed to sync rated match:', syncError);
            }
        }
    }

    revalidatePath(`/dashboard/tournaments/${match.tournament.id}`);
}

export async function assignTable(matchId: string, tableName: string) {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    const supabase = await createClient();

    // 1. Get Tournament ID for revalidation
    const { data: match, error: fetchError } = await supabase
        .from('tournament_matches')
        .select('tournament_id')
        .eq('id', matchId)
        .single();

    if (fetchError || !match) throw new Error('Match not found');

    // 2. Update Table
    const { error } = await supabase
        .from('tournament_matches')
        .update({ table_assigned: tableName })
        .eq('id', matchId);

    if (error) {
        console.error('Error assigning table:', error);
        throw new Error('Failed to assign table');
    }

    revalidatePath(`/dashboard/tournaments/${match.tournament_id}`);
}
