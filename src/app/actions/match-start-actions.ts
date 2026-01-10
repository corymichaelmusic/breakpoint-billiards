'use server'

import { createAdminClient } from "@/utils/supabase/admin";
import { calculateRace } from "@/utils/fargo";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function startMatch(matchId: string, leagueId: string, raceType: 'short' | 'long', gameType: '8ball' | '9ball') {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) return { error: "Unauthorized" };

    // 1. Fetch match and profiles to calculate race AND verify ownership
    const { data: match } = await supabase
        .from("matches")
        .select(`
      *,
      player1:player1_id(fargo_rating),
      player2:player2_id(fargo_rating),
      leagues(operator_id)
    `)
        .eq("id", matchId)
        .single();

    if (!match) return { error: "Match not found" };
    if (match.is_forfeit) return { error: "Match is forfeited" };

    // Verify Ownership
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    const isAdmin = profile?.role === 'admin';
    const leagueData = Array.isArray(match.leagues) ? match.leagues[0] : match.leagues;
    const isOperator = leagueData?.operator_id === userId;

    if (!isOperator && !isAdmin) {
        return { error: "Unauthorized. Only the Operator can start a match with race verification." };
    }

    // 2. Calculate Race
    const races = calculateRace(match.player1.fargo_rating, match.player2.fargo_rating);
    const selectedRace = races[raceType];

    // 3. Update Match
    const updates: any = {
        status: "in_progress", // Overall status
        played_at: new Date().toISOString(),
    };

    if (gameType === '8ball') {
        updates.status_8ball = 'in_progress';
        updates.started_at_8ball = new Date().toISOString();
        updates.race_8ball_p1 = selectedRace.p1;
        updates.race_8ball_p2 = selectedRace.p2;
        updates.points_8ball_p1 = 0;
        updates.points_8ball_p2 = 0;
    } else {
        updates.status_9ball = 'in_progress';
        updates.started_at_9ball = new Date().toISOString();
        updates.race_9ball_p1 = selectedRace.p1;
        updates.race_9ball_p2 = selectedRace.p2;
        updates.points_9ball_p1 = 0;
        updates.points_9ball_p2 = 0;
    }

    const { error } = await supabase
        .from("matches")
        .update(updates)
        .eq("id", matchId);

    if (error) {
        console.error("Error starting match:", error);
        return { error: "Failed to start match" };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}/matches/${matchId}/score`);
}
