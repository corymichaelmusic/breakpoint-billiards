'use server'

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function submitMatchScore(formData: FormData) {
    const matchId = formData.get("matchId") as string;
    const leagueId = formData.get("leagueId") as string;

    const score_8ball_p1 = parseInt(formData.get("score_8ball_p1") as string);
    const score_8ball_p2 = parseInt(formData.get("score_8ball_p2") as string);
    const score_9ball_p1 = parseInt(formData.get("score_9ball_p1") as string);
    const score_9ball_p2 = parseInt(formData.get("score_9ball_p2") as string);

    console.log("Submitting score:", { matchId, leagueId, score_8ball_p1, score_8ball_p2, score_9ball_p1, score_9ball_p2 });

    if (!matchId || !leagueId || isNaN(score_8ball_p1) || isNaN(score_8ball_p2) || isNaN(score_9ball_p1) || isNaN(score_9ball_p2)) {
        console.error("Invalid input for match score submission");
        return { error: "Invalid input" };
    }

    const supabase = createAdminClient();

    const { error } = await supabase
        .from("matches")
        .update({
            score_8ball_p1,
            score_8ball_p2,
            score_9ball_p1,
            score_9ball_p2,
            status: "finalized",
            played_at: new Date().toISOString(),
        })
        .eq("id", matchId);

    if (error) {
        console.error("Error submitting score:", error);
        return { error: "Failed to submit score" };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    redirect(`/dashboard/operator/leagues/${leagueId}`);
}

export async function requestUnlock(matchId: string, reason: string) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());

    if (!userId) return { error: "Unauthorized" };

    // Verify user is part of the match
    const { data: match } = await supabase
        .from("matches")
        .select("player1_id, player2_id")
        .eq("id", matchId)
        .single();

    if (!match || (match.player1_id !== userId && match.player2_id !== userId)) {
        return { error: "You are not a participant in this match" };
    }

    const { error } = await supabase
        .from("reschedule_requests")
        .insert({
            match_id: matchId,
            requester_id: userId,
            reason: reason,
            status: 'pending_operator' // Direct to operator
        });

    if (error) {
        console.error("Error requesting unlock:", error);
        return { error: "Failed to request unlock" };
    }

    revalidatePath(`/dashboard`);
    return { success: true };
}

export async function respondToRescheduleRequest(requestId: string, approved: boolean) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());

    if (!userId) return { error: "Unauthorized" };

    // Verify user is the opponent (not the requester)
    const { data: request } = await supabase
        .from("reschedule_requests")
        .select("*, matches:match_id(player1_id, player2_id)")
        .eq("id", requestId)
        .single();

    if (!request) return { error: "Request not found" };

    // @ts-ignore
    const match = Array.isArray(request.matches) ? request.matches[0] : request.matches;
    const isRequester = request.requester_id === userId;
    const isParticipant = match.player1_id === userId || match.player2_id === userId;

    if (!isParticipant || isRequester) {
        return { error: "You are not authorized to respond to this request" };
    }

    const newStatus = approved ? 'pending_operator' : 'rejected';

    const { error } = await supabase
        .from("reschedule_requests")
        .update({ status: newStatus })
        .eq("id", requestId);

    if (error) {
        console.error("Error responding to reschedule:", error);
        return { error: "Failed to update request" };
    }

    revalidatePath(`/dashboard`);
    return { success: true };
}

export async function approveRescheduleRequest(requestId: string, approved: boolean) {
    const supabase = createAdminClient();
    // Ideally verify operator role here, but RLS handles it too if we used user client.
    // Since we use admin client, we should verify role manually or trust the caller (Operator Dashboard).
    // For safety, let's verify.
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());
    if (!userId) return { error: "Unauthorized" };

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (profile?.role !== 'operator' && profile?.role !== 'admin') {
        return { error: "Unauthorized" };
    }

    const { data: request } = await supabase
        .from("reschedule_requests")
        .select("*")
        .eq("id", requestId)
        .single();

    if (!request) return { error: "Request not found" };

    if (approved) {
        // Unlock the match manually
        const { error: matchError } = await supabase
            .from("matches")
            .update({ is_manually_unlocked: true })
            .eq("id", request.match_id);

        if (matchError) return { error: "Failed to unlock match" };

        // Update request status
        await supabase
            .from("reschedule_requests")
            .update({ status: 'approved' })
            .eq("id", requestId);
    } else {
        await supabase
            .from("reschedule_requests")
            .update({ status: 'rejected' })
            .eq("id", requestId);
    }

    revalidatePath(`/dashboard/operator`);
    return { success: true };
}

export async function dismissRescheduleRequest(requestId: string) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());

    if (!userId) return { error: "Unauthorized" };

    // Verify ownership (requester) or involvement?
    // Usually only the requester sees the final status notification to dismiss?
    // The UI shows it to the requester.

    const { error } = await supabase
        .from("reschedule_requests")
        .update({ dismissed: true })
        .eq("id", requestId)
        .eq("requester_id", userId); // Security: only requester can dismiss their notification

    if (error) {
        console.error("Error dismissing request:", error);
        return { error: "Failed to dismiss request" };
    }

    revalidatePath(`/dashboard`);
    return { success: true };
}

export async function checkMatchLock(matchId: string) {
    const supabase = createAdminClient();

    const { data: match } = await supabase
        .from("matches")
        .select("scheduled_date, is_manually_unlocked, submitted_at")
        .eq("id", matchId)
        .single();

    if (!match) return { locked: true, reason: "Match not found" };

    // Manual unlock overrides everything (allows editing submitted matches)
    if (match.is_manually_unlocked) return { locked: false };

    // Submitted matches are locked
    if (match.submitted_at) return { locked: true, reason: "Match has been submitted." };

    if (!match.scheduled_date) return { locked: false }; // If no date set, assume unlocked

    const scheduledTime = new Date(match.scheduled_date).getTime();
    const now = new Date().getTime();

    // Window: 8 AM on scheduled date to 8 AM next day
    // Assuming scheduled_date is stored as the date (e.g., 2025-05-12 00:00:00 UTC)
    // We need to parse it correctly.
    // Let's assume scheduled_date includes the time or is just the date.
    // If it's just date, we set window from 8 AM that day.

    const matchDate = new Date(match.scheduled_date);
    // Set to 8 AM local time? Or UTC?
    // The requirement says "Beginning at 8 AM and ending at 8 AM the next day".
    // Assuming the league is in a specific timezone or user's local time.
    // For simplicity, let's use the stored time as the reference.
    // If scheduled_date is "2025-05-12", we assume that's the day.

    // Let's construct the window start/end.
    // We'll treat scheduled_date as the "Day".
    const startWindow = new Date(matchDate);
    startWindow.setHours(8, 0, 0, 0);

    const endWindow = new Date(startWindow);
    endWindow.setDate(endWindow.getDate() + 1);

    if (now >= startWindow.getTime() && now < endWindow.getTime()) {
        return { locked: false };
    }

    return { locked: true, reason: `Match is locked. Play window: ${startWindow.toLocaleString()} - ${endWindow.toLocaleString()}` };
}

export async function updateMatchDate(matchId: string, newDate: string) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());
    if (!userId) return { error: "Unauthorized" };

    // Verify operator
    const { data: match } = await supabase.from("matches").select("league_id").eq("id", matchId).single();
    if (!match) return { error: "Match not found" };

    const { data: league } = await supabase.from("leagues").select("operator_id").eq("id", match.league_id).single();
    if (league?.operator_id !== userId) {
        // Also check if admin
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
        if (profile?.role !== 'admin') return { error: "Unauthorized" };
    }

    const { error } = await supabase
        .from("matches")
        .update({ scheduled_date: newDate })
        .eq("id", matchId);

    if (error) return { error: "Failed to update date" };

    revalidatePath(`/dashboard/operator/leagues/${match.league_id}`);
    return { success: true };
}

export async function toggleMatchLock(matchId: string, unlock: boolean) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());
    if (!userId) return { error: "Unauthorized" };

    // Verify operator
    const { data: match } = await supabase.from("matches").select("league_id").eq("id", matchId).single();
    if (!match) return { error: "Match not found" };

    const { data: league } = await supabase.from("leagues").select("operator_id").eq("id", match.league_id).single();
    if (league?.operator_id !== userId) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
        if (profile?.role !== 'admin') return { error: "Unauthorized" };
    }

    const { error } = await supabase
        .from("matches")
        .update({ is_manually_unlocked: unlock })
        .eq("id", matchId);

    if (error) return { error: "Failed to toggle lock" };

    revalidatePath(`/dashboard/operator/leagues/${match.league_id}`);
    revalidatePath(`/dashboard`);
    revalidatePath(`/dashboard/upcoming`);
    revalidatePath(`/dashboard/session/${match.league_id}`); // Assuming league_id corresponds to session id in URL
    return { success: true };
}
