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
      player1:player1_id(breakpoint_rating),
      player2:player2_id(breakpoint_rating),
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

    // 2. Calculate Race using Breakpoint Rating (Matrix-based)
    // Note: calculateRace returns { short: 8Ball, long: 9Ball } based on new implementation
    // BUT raceType argument is 'short' or 'long'.
    // Logic: If user selected 'short', they likely want the 8Ball race? 
    // Or did we map Short->8Ball and Long->9Ball?
    // In MatrixStartScreen: "Select Race Format" -> Short/Long.
    // If we map short->8Ball, does selecting 8Ball game type force "Short"?
    // User selects Game Type (8ball/9ball) AND Race Format (Short/Long).
    // This is confusing if we mapped Short=8ball Matrix.
    // However, for now, we pass Breakpoint Rating.

    const races = calculateRace(match.player1.breakpoint_rating, match.player2.breakpoint_rating);
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
