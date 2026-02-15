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
        .select("scheduled_date, is_manually_unlocked, submitted_at, leagues(timezone)")
        .eq("id", matchId)
        .single();

    if (!match) return { locked: true, reason: "Match not found" };

    // Manual unlock overrides everything (allows editing submitted matches)
    if (match.is_manually_unlocked) return { locked: false };

    // Submitted matches are locked
    if (match.submitted_at) return { locked: true, reason: "Match has been submitted." };

    if (!match.scheduled_date) return { locked: false }; // If no date set, assume unlocked

    // Parse the scheduled_date string (YYYY-MM-DD)
    // We treat the date part as the intended "Day of Play" in CST.
    const datePart = new Date(match.scheduled_date).toISOString().split('T')[0]; // "2026-02-16"

    // Construct the Unlock Window Start: 8 AM CST on that date.
    // We can use a string construction "YYYY-MM-DDT08:00:00" and parse it as CST/local?
    // Safer: Work in UTC equivalents or use Intl.

    // Target: 8 AM CST (or CDT). "America/Chicago".
    // We need to check if NOW (in Chicago) is >= 8 AM on the Match Day.

    const now = new Date();

    // Get "Now" in Chicago Time parts
    const chicagoNowStr = now.toLocaleString("en-US", { timeZone: "America/Chicago", hour12: false });
    // This gives "2/15/2026, 10:24:32" format roughly, but format varies.
    // Better to use Intl.DateTimeFormat to get ISO-like parts or timestamps.

    // Alternative:
    // Create the 'Start Window' timestamp in absolute ms.
    // We want 8:00 AM America/Chicago on `datePart`.
    // Since we are in Node, we might not have a heavy timezone lib.
    // But we can approximate or use offsets if we assume CST is -6 (Standard) or -5 (Daylight).
    // Spring 2026 starts DST in March. Feb is Standard (-06:00).
    // "Spring 2026" - User said match is "Tomorrow" (Feb 16). That is Standard Time.

    // Let's rely on string parsing which is cleaner than offsets.
    // We want to construct a Date object that represents 08:00 CST on `datePart`.
    // "2026-02-16T08:00:00-06:00"

    // Determine offset for that date?
    // We can just assume -06:00 for Feb? Or better:

    // Let's compare "Day strings".
    // 1. Get Current Chicago Time.
    // 2. Check if Current Chicago Date < Match Date -> Locked (Too early day)
    // 3. Check if Current Chicago Date == Match Date:
    //      Check if Current Chicago Hour >= 8 -> Unlocked
    //      Else -> Locked
    // 4. Check if Current Chicago Date > Match Date -> Unlocked (Past day, but same week usually ok?)
    //    User said "Ending at 8 AM the next day".

    // Get League Timezone or default to CST (Chicago) or UTC if undefined
    // @ts-ignore
    const leagueData = Array.isArray(match.leagues) ? match.leagues[0] : match.leagues;
    const timeZone = leagueData?.timezone || "America/Chicago";

    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;

    const nowYear = parseInt(getPart('year')!);
    const nowMonth = parseInt(getPart('month')!);
    const nowDay = parseInt(getPart('day')!);
    const nowHour = parseInt(getPart('hour')!);

    // Parse Match Date (YYYY-MM-DD from the DB string)
    // match.scheduled_date is likely "2026-02-16T00:00:00+00:00" or similar
    // We want just the YMD.
    const [mYear, mMonth, mDay] = datePart.split('-').map(Number);

    // Compare Dates
    // Create comparable numbers YYYYMMDD
    const nowYMD = nowYear * 10000 + nowMonth * 100 + nowDay;
    const matchYMD = mYear * 10000 + mMonth * 100 + mDay;

    // Window Start: Match Day @ 08:00
    // Window End: Next Day @ 08:00

    if (nowYMD < matchYMD) {
        // Today is BEFORE Match Day
        return { locked: true, reason: `Match starts on ${datePart} at 8:00 AM (${timeZone}).` };
    }

    if (nowYMD === matchYMD) {
        // Today IS Match Day
        if (nowHour < 8) {
            return { locked: true, reason: `Match starts at 8:00 AM (${timeZone}).` };
        }
        return { locked: false };
    }

    if (nowYMD > matchYMD) {
        // Today is AFTER Match Day.
        // Check if it's the "Next Day" and before 8 AM.

        // Calculate Next Day YMD
        const matchDateObj = new Date(mYear, mMonth - 1, mDay);
        const nextDateObj = new Date(matchDateObj);
        nextDateObj.setDate(nextDateObj.getDate() + 1);

        const nYear = nextDateObj.getFullYear();
        const nMonth = nextDateObj.getMonth() + 1;
        const nDay = nextDateObj.getDate();

        const nextYMD = nYear * 10000 + nMonth * 100 + nDay;

        if (nowYMD === nextYMD) {
            // It is the day strictly after.
            if (nowHour < 8) {
                return { locked: false }; // Still in the window (until 8 AM)
            }
            return { locked: true, reason: `Match window ended today at 8:00 AM (${timeZone}).` };
        }

        // If more than 1 day past
        return { locked: true, reason: `Match window expired.` };
    }

    return { locked: true, reason: "Match is locked." };
}

export async function updateMatchDate(matchId: string, newDate: string) {
    return updateMatchSchedule(matchId, newDate, undefined, undefined);
}

export async function updateMatchSchedule(matchId: string, newDate: string, newTime?: string, newTable?: string) {
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

    const updates: any = {};
    if (newDate) updates.scheduled_date = newDate;
    if (newTime !== undefined) updates.scheduled_time = newTime;
    if (newTable !== undefined) updates.table_name = newTable;

    const { error } = await supabase
        .from("matches")
        .update(updates)
        .eq("id", matchId);

    if (error) return { error: "Failed to update schedule" };

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
