
import { SupabaseClient } from "@supabase/supabase-js";

interface Participant {
    id: string; // The row ID in tournament_participants
    player_id: string;
    seed: number;
}

export async function generateBracket(
    supabase: SupabaseClient,
    tournamentId: string,
    participants: Participant[]
) {
    // 1. Determine Bracket Size (Power of 2 >= participants)
    const count = participants.length;
    let size = 2;
    while (size < count) size *= 2;

    // 2. Random Seed (Shuffle participants)
    const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
    // Assign temp seeds based on shuffle order to satisfy the rest of the logic
    const sortedPlayers = shuffledParticipants.map((p, index) => ({ ...p, seed: index + 1 }));

    // 3. Generate First Round Matchups (Standard Snake/Fold Method for Seeding)
    // For a simple version, we'll just pair 1 vs N, 2 vs N-1, etc. inside the bracket slots.
    // Actually, proper seeding is: 1 vs Size, 2 vs Size-1...
    // But since we might have Byes (if count < size), Byes are virtual players.

    // We can define the "slots" for the first round.
    const totalRounds = Math.log2(size);
    const matches = [];

    // Helper to find opponent for Round 1 (1 vs 16, 2 vs 15...)
    // Standard seeding: 1 plays Size, 2 plays Size-1... (Top vs Bottom of list)

    // Generate All Rounds
    for (let round = 1; round <= totalRounds; round++) {
        const matchesInRound = size / Math.pow(2, round);

        for (let i = 0; i < matchesInRound; i++) {
            const matchNum = i + 1;
            const positionCode = `WR${round}-${matchNum}`;

            let playerA_ID = null;
            let playerB_ID = null;
            let status = 'pending';
            let winner_ID = null;
            let score1 = 0;
            let score2 = 0;

            // Round 1: Populate with Players
            if (round === 1) {
                const seedA = i + 1;
                const seedB = size - i;

                // Find them in the randomized `sortedPlayers` list
                // actually sortedPlayers indices are not seeds anymore, they are just random slots.
                // But we assigned them .seed = index+1. So finding by seed works.
                const playerA = sortedPlayers.find(p => p.seed === seedA);
                const playerB = sortedPlayers.find(p => p.seed === seedB);

                playerA_ID = playerA?.id || null;
                playerB_ID = playerB?.id || null;

                // Automatic Bye Handling
                if (playerA_ID && !playerB_ID) {
                    status = 'completed';
                    winner_ID = playerA_ID;
                }

                // If both null (shouldn't happen in standard bracket), status is scheduled
                if (playerA_ID && playerB_ID) {
                    status = 'ready';
                }
            }

            matches.push({
                tournament_id: tournamentId,
                player1_id: playerA_ID,
                player2_id: playerB_ID,
                winner_id: winner_ID,
                round_label: `Winners Round ${round}`,
                match_position_code: positionCode,
                status: status,
                score1: score1,
                score2: score2,
                // table_assigned defaults to null in DB
            });
        }
    }

    // Insert Matches
    const { error } = await supabase
        .from('tournament_matches')
        .insert(matches);

    if (error) {
        console.error('Error creating bracket:', error);
        throw error;
    }

    return matches;
}
