'use server'

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createSession(
    parentLeagueId: string,
    name: string,
    startDate: string | null = null,
    bounties: {
        bounty8Run?: number,
        bounty9Run?: number,
        bounty9Snap?: number,
        bountyShutout?: number
    } = {}
) {
    const supabase = createAdminClient();
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) return { error: "Unauthorized" };

    // 1. Verify parent league ownership
    // 1. Fetch parent league
    const { data: parent } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", parentLeagueId)
        .single();

    if (!parent) return { error: "Parent league not found." };

    // 2. Verify permission (Operator, Assigned Operator, or Admin)
    let isAuthorized = false;

    // Check if owner
    if (parent.operator_id === userId) {
        isAuthorized = true;
    } else {
        // Check if assigned operator
        const { data: assignedOp } = await supabase
            .from("league_operators")
            .select("id")
            .eq("league_id", parentLeagueId)
            .eq("user_id", userId)
            .single();

        if (assignedOp) {
            isAuthorized = true;
        } else {
            // Check if global admin
            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", userId)
                .single();

            if (profile?.role === 'admin') {
                isAuthorized = true;
            }
        }
    }

    if (!isAuthorized) return { error: "Unauthorized. You do not have permission to create a session for this league." };

    // 2. Check for active sessions (limit 3 active sessions per league)
    const { count } = await supabase
        .from("leagues")
        .select("*", { count: 'exact', head: true })
        .eq("parent_league_id", parentLeagueId)
        .in("status", ['setup', 'active']);

    if (count && count >= 3) {
        return { error: "You have reached the limit of 3 active sessions. Please complete one first." };
    }

    // 3. Fetch Global Fees (Session Fee & Creation Fee)
    const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["default_session_fee", "default_creation_fee"]);

    const sessionFeeSetting = settings?.find(s => s.key === "default_session_fee");
    const creationFeeSetting = settings?.find(s => s.key === "default_creation_fee");

    const sessionFee = sessionFeeSetting ? Number(sessionFeeSetting.value) : 25; // Default fallback
    const creationFee = creationFeeSetting ? Number(creationFeeSetting.value) : 100; // Default fallback

    // 4. Create Session
    const { data: newSession, error } = await supabase
        .from("leagues")
        .insert({
            name: name, // e.g. "Fall 2025"
            location: parent.location,
            city: parent.city,
            state: parent.state,
            schedule_day: parent.schedule_day,
            operator_id: userId,
            status: 'setup',
            type: 'session',
            parent_league_id: parentLeagueId,
            creation_fee_status: 'unpaid', // Default to unpaid
            session_fee: sessionFee,
            creation_fee: creationFee,
            start_date: startDate,
            bounty_val_8_run: bounties.bounty8Run || 0,
            bounty_val_9_run: bounties.bounty9Run || 0,
            bounty_val_9_snap: bounties.bounty9Snap || 0,
            bounty_val_shutout: bounties.bountyShutout || 0
        })
        .select("id")
        .single();

    if (error) {
        console.error("Error creating session:", error);
        return { error: "Failed to create session." };
    }

    revalidatePath("/dashboard/operator");
    return { success: true, sessionId: newSession.id };
}

export async function addPlayersToSession(sessionId: string, playerIds: string[]) {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient(); // Authenticated client
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) return { error: "Unauthorized" };

    if (!playerIds || playerIds.length === 0) {
        return { error: "No players selected." };
    }

    // VERIFY OWNERSHIP: The caller must be the operator of the parent league
    // 1. Get Session -> Parent League -> Operator
    const { data: session } = await supabase
        .from("leagues")
        .select("parent_league_id")
        .eq("id", sessionId)
        .single();

    if (!session || !session.parent_league_id) return { error: "Session not found or invalid." };

    const { data: parentLeague } = await supabase
        .from("leagues")
        .select("operator_id")
        .eq("id", session.parent_league_id)
        .single();

    if (!parentLeague) return { error: "Parent league not found." };

    // Check if user is the operator (or Admin - though admin client would bypass this, here we use auth client which RLS might block if not admin, but owner has rights)
    // Actually, RLS usually allows INSERT if you own the resource. 
    // But since we are inserting into `league_players`, the RLS policy for `league_players` might be complex.
    // If the RLS allows "Operator of league can insert players", then `createClient` is sufficient.
    // IF NOT, we might STILL need `createAdminClient` BUT ONLY AFTER WE VERIFY HERE.
    // Given the audit complaint was "Admin Client Overuse" and "No Verification", 
    // The BEST fix is: Verify here, THEN use Admin Client if RLS is too restrictive, OR fix RLS.
    // For now, let's explicitely VERIFY here, and if we stick to `supabase` (authed), we assume RLS exists.
    // If RLS is missing for operators, `createClient` might fail.
    // SAFE APPROACH: Explicitly check operator_id here.

    // Check Admin Role
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    const isAdmin = profile?.role === 'admin';

    let isAuthorized = parentLeague.operator_id === userId || isAdmin;

    if (!isAuthorized) {
        const { data: assigned } = await supabase
            .from("league_operators")
            .select("id")
            .eq("league_id", session.parent_league_id)
            .eq("user_id", userId)
            .single();
        if (assigned) isAuthorized = true;
    }

    if (!isAuthorized) {
        return { error: "Unauthorized. Only the League Operator can add players." };
    }

    // Now we are authorized.
    // We can use `createAdminClient` if we need to bypass RLS for the actual insert (if RLS is strict on 'public' inserting to others tables),
    // OR use the authed client. 
    // The Audit says "Should Be: const supabase = await createClient(); // Uses JWT".
    // So let's try using the authed client. If it fails due to RLS, we fix RLS or revert to Admin-after-check.
    // However, mass-inserting usually requires admin privileges or RLS "insert if user is operator of league_id".

    const records = playerIds.map(pid => ({
        league_id: sessionId,
        player_id: pid,
        status: 'active', // Auto-active for session roster
        payment_status: 'unpaid' // Reset payment for new session
    }));

    const { error } = await supabase
        .from("league_players")
        .insert(records);

    if (error) {
        console.error("Error adding players to session:", error);
        return { error: "Failed to add players." };
    }

    revalidatePath(`/dashboard/operator/leagues/${sessionId}`);
    return { success: true };
}

export async function syncSessionPlayers(sessionId: string, playerIds: string[]) {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) return { error: "Unauthorized" };

    // VERIFY OWNERSHIP
    const { data: session } = await supabase.from("leagues").select("parent_league_id").eq("id", sessionId).single();
    if (!session || !session.parent_league_id) return { error: "Session invalid." };

    const { data: parentLeague } = await supabase.from("leagues").select("operator_id").eq("id", session.parent_league_id).single();
    if (!parentLeague) return { error: "Parent league not found." };

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    const isAdmin = profile?.role === 'admin';

    let isAuthorized = parentLeague.operator_id === userId || isAdmin;

    if (!isAuthorized) {
        const { data: assigned } = await supabase
            .from("league_operators")
            .select("id")
            .eq("league_id", session.parent_league_id)
            .eq("user_id", userId)
            .single();
        if (assigned) isAuthorized = true;
    }

    if (!isAuthorized) {
        return { error: "Unauthorized. Only the League Operator can sync players." };
    }

    // 1. Get current players in session
    const { data: currentPlayers } = await supabase
        .from("league_players")
        .select("player_id")
        .eq("league_id", sessionId);

    const currentIds = currentPlayers?.map(p => p.player_id) || [];

    // 2. Identify additions and removals
    const toAdd = playerIds.filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter(id => !playerIds.includes(id));

    // 3. Add new players
    if (toAdd.length > 0) {
        const records = toAdd.map(pid => ({
            league_id: sessionId,
            player_id: pid,
            status: 'active',
            payment_status: 'unpaid'
        }));

        const { error } = await supabase.from("league_players").insert(records);
        if (error) {
            console.error("Error adding players:", error);
            return { error: "Failed to add players." };
        }
    }

    // 4. Remove players (only if they haven't played games - for now we assume safe in setup)
    // TODO: Add check for existing games if we want to be stricter
    if (toRemove.length > 0) {
        const { error } = await supabase
            .from("league_players")
            .delete()
            .eq("league_id", sessionId)
            .in("player_id", toRemove);

        if (error) {
            console.error("Error removing players:", error);
            return { error: "Failed to remove players." };
        }
    }

    revalidatePath(`/dashboard/operator/leagues/${sessionId}`);
    return { success: true };
}

export async function generateSchedule(
    leagueId: string,
    skipDates: string[] = [],
    inputTimeSlots: string[] = [],
    inputTableNames: string[] = [],
    overrideStartDate?: string
) {
    const supabase = createAdminClient();

    console.log(`[generateSchedule] Called for League: ${leagueId}, OverrideStart: ${overrideStartDate}`);

    // 0. Update League Config if provided (Time Slots / Tables / Start Date if forced)
    const updateData: any = {};
    if (inputTimeSlots && inputTimeSlots.length > 0) updateData.time_slots = inputTimeSlots;
    if (inputTableNames && inputTableNames.length > 0) {
        updateData.table_names = inputTableNames;
        updateData.table_count = inputTableNames.length;
    }
    // If overrideStartDate is provided, ensure it's saved/updated in case updateLeague missed it
    if (overrideStartDate) {
        updateData.start_date = overrideStartDate;
    }

    if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase.from("leagues").update(updateData).eq("id", leagueId);
        if (updateError) {
            console.error("[generateSchedule] Update Error:", updateError);
        }
    }

    // 0. Check Fee Status and Start Date
    const { data: league, error: fetchError } = await supabase.from("leagues").select("creation_fee_status, start_date, time_slots, table_names").eq("id", leagueId).single();

    if (fetchError) {
        console.error("[generateSchedule] League Fetch Error:", fetchError);
    }

    // Use overrideStartDate if present, otherwise DB value
    const effectiveStartDate = overrideStartDate || league?.start_date;

    if (!league) {
        console.error(`[generateSchedule] League not found for ID: ${leagueId}`);
        return { error: "League not found." };
    }

    if (league.creation_fee_status === 'unpaid') {
        return { error: "Session creation fee must be paid or waived by Admin before generating schedule." };
    }
    if (!effectiveStartDate) {
        return { error: "Session must have a Start Date set before generating schedule." };
    }

    // 1. Check if matches already exist
    const { count } = await supabase
        .from("matches")
        .select("*", { count: 'exact', head: true })
        .eq("league_id", leagueId);

    if (count && count > 0) {
        return { error: "Schedule already exists." };
    }

    // 2. Fetch players in the league
    const { data: leaguePlayers, error: playersError } = await supabase
        .from("league_players")
        .select("player_id, payment_status")
        .eq("league_id", leagueId);

    if (playersError || !leaguePlayers || leaguePlayers.length < 2) {
        console.error("Not enough players to generate schedule");
        return { error: "NOT_ENOUGH_PLAYERS" };
    }

    const playerIds = leaguePlayers.map(lp => lp.player_id);

    // Randomize player order for random initial matchups
    playerIds.sort(() => Math.random() - 0.5);

    // 2. Generate Round Robin Schedule
    if (playerIds.length % 2 !== 0) {
        playerIds.push("bye");
    }

    const n = playerIds.length;
    const rounds = n - 1;
    const matches = [];
    const totalMatchWeeks = 16; // We want 16 weeks of PLAY

    // Parse start date explicitly
    const [y, m, d] = effectiveStartDate.split('-').map(Number);
    const startDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

    // Helper to check if a date is skipped
    // skipDates are in "YYYY-MM-DD" format.
    // We compare with the ISO string date part of the calculated match date.

    // Table and Time Slot Config
    const timeSlots = (league.time_slots && Array.isArray(league.time_slots) && league.time_slots.length > 0)
        ? league.time_slots
        : ["19:00"]; // Default to 7 PM if none configured

    const tableNames = (league.table_names && Array.isArray(league.table_names) && league.table_names.length > 0)
        ? league.table_names
        : ["Table 1"]; // Default to Table 1 if none configured

    let currentWeekOfPlay = 1;
    let calendarWeekOffset = 0;

    // Loop until we have generated 16 weeks of MATCHES
    while (currentWeekOfPlay <= totalMatchWeeks) {
        // Calculate the candidate date for this calendar week
        const candidateDate = new Date(startDate);
        candidateDate.setUTCDate(startDate.getUTCDate() + (calendarWeekOffset * 7));

        const candidateDateString = candidateDate.toISOString().split('T')[0];

        // Check if this date is in the skip list
        if (skipDates.includes(candidateDateString)) {
            // SKIP this week
            console.log(`Skipping date: ${candidateDateString}`);
            calendarWeekOffset++; // Move to next calendar week
            continue; // Do NOT increment currentWeekOfPlay
        }

        // If not skipped, generate matches for this week
        const roundIndex = (currentWeekOfPlay - 1) % rounds;

        // Indices for this round
        let currentPlayers = [...playerIds];

        // Rotate players array for the current round
        for (let r = 0; r < roundIndex; r++) {
            const last = currentPlayers.pop();
            if (last) currentPlayers.splice(1, 0, last);
        }

        // Now pair them up
        let matchIndexInWeek = 0;

        // Generate shuffled slot indices for this week to randomize Time/Table assignment
        const totalSlots = timeSlots.length * tableNames.length;
        const numMatches = Math.floor(n / 2);
        const availableSlotIndices: number[] = [];
        for (let k = 0; k < numMatches; k++) {
            availableSlotIndices.push(k % totalSlots);
        }
        // Fisher-Yates Shuffle for better randomness
        for (let i = availableSlotIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableSlotIndices[i], availableSlotIndices[j]] = [availableSlotIndices[j], availableSlotIndices[i]];
        }

        for (let i = 0; i < n / 2; i++) {
            const p1 = currentPlayers[i];
            const p2 = currentPlayers[n - 1 - i];

            if (p1 !== "bye" && p2 !== "bye") {
                // Assign Time and Table using shuffled slots
                const slotIndex = availableSlotIndices[matchIndexInWeek];

                const timeIndex = Math.floor(slotIndex / tableNames.length) % timeSlots.length;
                const tableIndex = slotIndex % tableNames.length;

                const assignedTime = timeSlots[timeIndex];
                const assignedTable = tableNames[tableIndex];

                matches.push({
                    league_id: leagueId,
                    player1_id: p1,
                    player2_id: p2,
                    week_number: currentWeekOfPlay, // This stays 1..16
                    status: 'scheduled',
                    scheduled_date: candidateDate.toISOString(), // This reflects the actual skipped date
                    scheduled_time: assignedTime,
                    table_name: assignedTable
                });

                matchIndexInWeek++;
            }
        }

        currentWeekOfPlay++;
        calendarWeekOffset++;
    }

    // 3. Bulk Insert Matches
    const { error: insertError } = await supabase
        .from("matches")
        .insert(matches);

    if (insertError) {
        console.error("Error inserting matches:", insertError);
        return { error: "Failed to save schedule." };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}

export async function startSeason(leagueId: string) {
    const supabase = createAdminClient();

    // Check fee status
    const { data: league } = await supabase.from("leagues").select("creation_fee_status").eq("id", leagueId).single();

    if (league?.creation_fee_status === 'unpaid') {
        return { error: "Session creation fee must be paid or waived by Admin before starting." };
    }

    const { error } = await supabase
        .from("leagues")
        .update({ status: "active" })
        .eq("id", leagueId);

    if (error) {
        return { error: "Failed to start season." };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}

export async function joinLeague(leagueId: string, userId: string) {
    console.log(`Attempting to join league: ${leagueId} for user: ${userId}`);
    const supabase = createAdminClient();

    const { error } = await supabase
        .from("league_players")
        .insert({
            league_id: leagueId,
            player_id: userId,
            status: 'pending'
        });

    if (error) {
        console.error("Error joining league:", error);
        return { error: "Failed to join league." };
    }

    console.log("Successfully joined league (pending)");
    revalidatePath("/dashboard");
    return { success: true };
}

export async function approvePlayer(leagueId: string, playerId: string) {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from("league_players")
        .update({ status: 'active' })
        .eq("league_id", leagueId)
        .eq("player_id", playerId);

    if (error) {
        console.error("Error approving player:", error);
        return { error: "Failed to approve player." };
    }

    // Check if this is a Session, and if so, add to Parent League
    const { data: league } = await supabase
        .from("leagues")
        .select("type, parent_league_id")
        .eq("id", leagueId)
        .single();

    if (league?.type === 'session' && league.parent_league_id) {
        // Check if already in parent league
        const { data: existing } = await supabase
            .from("league_players")
            .select("status")
            .eq("league_id", league.parent_league_id)
            .eq("player_id", playerId)
            .single();

        if (!existing) {
            // Add to parent league
            await supabase
                .from("league_players")
                .insert({
                    league_id: league.parent_league_id,
                    player_id: playerId,
                    status: 'active' // Auto-active in Org if approved for Session
                });
        }
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}

export async function rejectPlayer(leagueId: string, playerId: string) {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from("league_players")
        .delete()
        .eq("league_id", leagueId)
        .eq("player_id", playerId);

    if (error) {
        console.error("Error rejecting player:", error);
        return { error: "Failed to reject player." };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}

export async function markMatchPaid(matchId: string, playerId: string, method: 'cash' | 'waived' | 'unpaid') {
    const supabase = createAdminClient();

    // Determine if player is p1 or p2
    const { data: match } = await supabase.from("matches").select("player1_id, player2_id").eq("id", matchId).single();

    if (!match) return { error: "Match not found" };

    const update: any = {};
    const status = method === 'unpaid' ? 'unpaid' : (method === 'cash' ? 'paid_cash' : 'waived');

    if (match.player1_id === playerId) {
        update.payment_status_p1 = status;
    } else if (match.player2_id === playerId) {
        update.payment_status_p2 = status;
    } else {
        return { error: "Player not in match" };
    }

    const { error } = await supabase
        .from("matches")
        .update(update)
        .eq("id", matchId);

    if (error) {
        console.error("Error updating payment:", error);
        return { error: "Failed to update payment." };
    }

    revalidatePath(`/dashboard/operator/leagues`);
    return { success: true };
}

export async function submitLeagueResults(leagueId: string) {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from("leagues")
        .update({ status: 'completed' })
        .eq("id", leagueId);

    if (error) {
        console.error("Error submitting league results:", error);
        return { error: "Failed to submit results." };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}

export async function deleteLeague(leagueId: string) {
    const supabase = createAdminClient();
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) return { error: "Unauthorized" };

    // Fetch league to check type
    const { data: league } = await supabase.from("leagues").select("type, operator_id, parent_league_id").eq("id", leagueId).single();

    if (!league) return { error: "League not found" };

    // Check if user is admin via database role
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    const isAdmin = profile?.role === 'admin';

    // If it's a top-level League Organization, ONLY Admin can delete
    if (league.type === 'league') {
        if (!isAdmin) {
            return { error: "Only Administrators can delete a League Organization." };
        }
    } else {
        // For sessions: allow operator or admin or assigned operator of parent
        let isAuthorized = league.operator_id === userId || isAdmin;

        if (!isAuthorized && league.parent_league_id) {
            const { data: assigned } = await supabase
                .from("league_operators")
                .select("id")
                .eq("league_id", league.parent_league_id)
                .eq("user_id", userId)
                .single();
            if (assigned) isAuthorized = true;
        }

        if (!isAuthorized) {
            return { error: "Only the operator or an administrator can delete this session." };
        }
    }

    // Delete the league (cascading deletes should handle related data if configured, 
    // but usually we want to be careful. For now, assuming cascade or manual cleanup isn't needed for this MVP step)
    const { error } = await supabase
        .from("leagues")
        .delete()
        .eq("id", leagueId);

    if (error) {
        console.error("Error deleting league:", error);
        return { error: "Failed to delete league." };
    }

    revalidatePath("/dashboard/operator");
    return { success: true };
}

export async function updateLeagueDetails(leagueId: string, data: {
    name: string,
    location: string,
    city: string,
    state: string,
    schedule_day: string,
    session_fee?: number,
    match_fee?: number,
    start_date?: string,
    bounty_val_8_run?: number,
    bounty_val_9_run?: number,
    bounty_val_9_snap?: number,
    bounty_val_shutout?: number
}) {
    const supabase = createAdminClient();
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) return { error: "Unauthorized" };

    console.log(`[updateLeagueDetails] Attempting update for league: ${leagueId} by user: ${userId}`);

    // Verify ownership or Admin role
    const { data: league } = await supabase
        .from("leagues")
        .select("operator_id")
        .eq("id", leagueId)
        .single();

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    const isAdmin = profile?.role === 'admin';

    console.log(`[updateLeagueDetails] Found league:`, league);
    console.log(`[updateLeagueDetails] User role: ${profile?.role}, Is Admin: ${isAdmin}`);

    if (!league || (league.operator_id !== userId && !isAdmin)) {
        console.error(`[updateLeagueDetails] Unauthorized. League Operator: ${league?.operator_id}, Current User: ${userId}, Is Admin: ${isAdmin}`);
        return { error: "Unauthorized to edit this league." };
    }

    const { error } = await supabase
        .from("leagues")
        .update({
            name: data.name,
            location: data.location,
            city: data.city,
            state: data.state,
            schedule_day: data.schedule_day,
            session_fee: data.session_fee,
            match_fee: data.match_fee,
            start_date: data.start_date,
            bounty_val_8_run: data.bounty_val_8_run,
            bounty_val_9_run: data.bounty_val_9_run,
            bounty_val_9_snap: data.bounty_val_9_snap,
            bounty_val_shutout: data.bounty_val_shutout
        })
        .eq("id", leagueId);

    if (error) {
        console.error("Error updating league details:", error);
        return { error: `Failed to update: ${error.message}` };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}

export async function joinSession(sessionId: string) {
    const supabase = createAdminClient();
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: "Not authenticated" };
    }

    // Check if already a member
    const { data: existing } = await supabase
        .from("league_players")
        .select("status")
        .eq("league_id", sessionId)
        .eq("player_id", userId)
        .single();

    if (existing) {
        return { success: false, message: "Already a member of this session" };
    }

    // Insert new membership
    // Default to 'active' for now since we don't have an approval flow for sessions yet, 
    // but maybe 'pending' is safer if we want to add approval later. 
    // For now, let's use 'active' to reduce friction as per MVP speed.
    // Actually, let's stick to 'pending' to be consistent with league joining, 
    // unless the user is the operator.

    // Wait, if they are already in the Org, maybe they should be auto-approved for the session?
    // Let's check Org membership first.

    const { data: session } = await supabase
        .from("leagues")
        .select("parent_league_id")
        .eq("id", sessionId)
        .single();

    if (!session) return { success: false, message: "Session not found" };

    // Check if user is the operator
    const { data: league } = await supabase
        .from("leagues")
        .select("operator_id")
        .eq("id", session.parent_league_id)
        .single();

    // Fetch user profile to check for debug role (e.g. if they switched to 'player' for testing)
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    // Auto-approve ONLY if it's the operator joining their own session AND they are not in debug 'player' mode
    const isOperator = league?.operator_id === userId && profile?.role !== 'player';
    const status = isOperator ? 'active' : 'pending';

    const { error } = await supabase
        .from("league_players")
        .insert({
            league_id: sessionId,
            player_id: userId,
            status: status,
            payment_status: 'unpaid'
        });

    if (error) {
        console.error("Error joining session:", error);
        return { success: false, message: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
}

export async function updateSessionPaymentStatus(sessionId: string, playerId: string, status: string) {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from("league_players")
        .update({ payment_status: status })
        .eq("league_id", sessionId)
        .eq("player_id", playerId);

    if (error) {
        console.error("Error updating session payment:", error);
        return { error: "Failed to update payment status." };
    }

    revalidatePath(`/dashboard/operator/leagues`);
    return { success: true };
}

export async function resetSchedule(leagueId: string) {
    const supabase = createAdminClient();
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) return { error: "Unauthorized" };

    // 1. Verify ownership
    const { data: league } = await supabase
        .from("leagues")
        .select("operator_id, status, parent_league_id")
        .eq("id", leagueId)
        .single();

    if (!league) return { error: "League not found" };

    // Check permissions
    let isAuthorized = league.operator_id === userId;

    if (!isAuthorized) {
        // Check Admin
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
        if (profile?.role === 'admin') {
            isAuthorized = true;
        } else {
            // Check Assigned Operator (if session, check parent; if league, check self)
            // But normally resetSchedule is for sessions.
            const targetId = league.parent_league_id || leagueId;
            const { data: assigned } = await supabase.from("league_operators").select("id").eq("league_id", targetId).eq("user_id", userId).single();
            if (assigned) isAuthorized = true;
        }
    }

    if (!isAuthorized) return { error: "Unauthorized" };
    if (league.status !== 'setup') return { error: "Can only reset schedule in setup mode." };

    // 2. Delete matches (and games via cascade or manual)
    // First delete games
    const { data: matches } = await supabase
        .from("matches")
        .select("id")
        .eq("league_id", leagueId);

    const matchIds = matches?.map(m => m.id) || [];

    if (matchIds.length > 0) {
        const { error: gamesError } = await supabase
            .from("games")
            .delete()
            .in("match_id", matchIds);

        if (gamesError) {
            console.error("Error deleting games:", gamesError);
            return { error: "Failed to delete games." };
        }
    }

    // Now delete matches
    const { error: deleteError } = await supabase
        .from("matches")
        .delete()
        .eq("league_id", leagueId);

    if (deleteError) {
        console.error("Error deleting matches:", deleteError);
        return { error: "Failed to delete matches." };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}

export async function updateLeague(leagueId: string, updates: any) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());
    if (!userId) return { error: "Unauthorized" };

    // Verify operator
    const { data: league } = await supabase.from("leagues").select("operator_id, parent_league_id").eq("id", leagueId).single();
    if (!league) return { error: "League not found" };

    // If it's a session, check parent league operator
    let targetLeagueId = leagueId;
    let operatorId = league.operator_id;

    if (league.parent_league_id) {
        targetLeagueId = league.parent_league_id;
        const { data: parent } = await supabase.from("leagues").select("operator_id").eq("id", league.parent_league_id).single();
        operatorId = parent?.operator_id;
    }

    if (operatorId !== userId) {
        // Check if global admin
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
        if (profile?.role === 'admin') {
            // Authorized
        } else {
            // Check if assigned operator for the TARGET league (Parent)
            const { data: assigned } = await supabase
                .from("league_operators")
                .select("id")
                .eq("league_id", targetLeagueId)
                .eq("user_id", userId)
                .single();

            if (!assigned) {
                return { error: "Unauthorized" };
            }
        }
    }

    const { error } = await supabase
        .from("leagues")
        .update(updates)
        .eq("id", leagueId);

    if (error) return { error: "Failed to update league" };

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}


export async function resetMatch(matchId: string, gameType: string) {
    const supabase = createAdminClient();
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) return { error: "Unauthorized" };

    // 1. Verify ownership (Operator of the league this match belongs to)
    const { data: match } = await supabase.from("matches").select("league_id").eq("id", matchId).single();
    if (!match) return { error: "Match not found" };

    const { data: league } = await supabase.from("leagues").select("operator_id, parent_league_id").eq("id", match.league_id).single();
    if (!league) return { error: "League not found" };

    // Check operator (or parent operator if session)
    let operatorId = league.operator_id;
    if (league.parent_league_id) {
        const { data: parent } = await supabase.from("leagues").select("operator_id").eq("id", league.parent_league_id).single();
        operatorId = parent?.operator_id;
    }

    // Check Admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    const isAdmin = profile?.role === 'admin';

    if (operatorId !== userId && !isAdmin) {
        return { error: "Unauthorized" };
    }

    // 2. Call RPC
    const { error } = await supabase.rpc('reset_match_stats', {
        p_match_id: matchId,
        p_game_type: gameType
    });

    if (error) {
        console.error("Error resetting match:", error);
        return { error: `Failed to reset match: ${error.message}` };
    }

    revalidatePath(`/dashboard/operator/leagues/${match.league_id}`);
    return { success: true };
}

export async function togglePlayerFee(leagueId: string, playerId: string, isPaid: boolean) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());
    if (!userId) return { error: "Unauthorized" };

    // Verify operator
    const { data: league } = await supabase.from("leagues").select("operator_id, parent_league_id").eq("id", leagueId).single();
    if (!league) return { error: "League not found" };

    let operatorId = league.operator_id;
    if (league.parent_league_id) {
        const { data: parent } = await supabase.from("leagues").select("operator_id").eq("id", league.parent_league_id).single();
        operatorId = parent?.operator_id;
    }

    if (operatorId !== userId) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
        if (profile?.role !== 'admin') return { error: "Unauthorized" };
    }

    const { error } = await supabase
        .from("league_players")
        .update({
            payment_status: isPaid ? 'paid' : 'unpaid',
            amount_paid: isPaid ? 25.00 : 0.00
        })
        .eq("league_id", leagueId)
        .eq("player_id", playerId);

    if (error) return { error: "Failed to update fee status" };

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    revalidatePath(`/dashboard/operator/leagues/${league.parent_league_id}/sessions/${leagueId}/add-players`);
    return { success: true };
}

export async function requestSessionReset(leagueId: string) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());
    if (!userId) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("leagues")
        .update({ reset_requested: true })
        .eq("id", leagueId);

    if (error) return { error: "Failed to request reset" };

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}

export async function approveSessionReset(leagueId: string) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());
    if (!userId) return { error: "Unauthorized" };

    // Verify admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (profile?.role !== 'admin') return { error: "Unauthorized" };

    // Reset logic: Delete matches, games, reschedule requests. Reset status.
    // Delete reschedule requests
    await supabase.from("reschedule_requests").delete().in("match_id",
        (await supabase.from("matches").select("id").eq("league_id", leagueId)).data?.map(m => m.id) || []
    );
    // Delete games
    await supabase.from("games").delete().in("match_id",
        (await supabase.from("matches").select("id").eq("league_id", leagueId)).data?.map(m => m.id) || []
    );
    // Delete matches
    await supabase.from("matches").delete().eq("league_id", leagueId);

    // Reset league status and flag
    const { error } = await supabase
        .from("leagues")
        .update({ status: 'setup', reset_requested: false })
        .eq("id", leagueId);

    if (error) return { error: "Failed to reset session" };

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}

export async function addPlayerToSession(sessionId: string, playerId: string) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());
    if (!userId) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("league_players")
        .insert({
            league_id: sessionId,
            player_id: playerId,
            status: 'active',
            payment_status: 'unpaid'
        });

    if (error) return { error: "Failed to add player" };

    revalidatePath(`/dashboard/operator/leagues/${sessionId}/sessions/${sessionId}/add-players`);
    return { success: true };
}

export async function removePlayerFromSession(sessionId: string, playerId: string) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());
    if (!userId) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("league_players")
        .delete()
        .eq("league_id", sessionId)
        .eq("player_id", playerId);

    if (error) return { error: "Failed to remove player" };

    revalidatePath(`/dashboard/operator/leagues/${sessionId}/sessions/${sessionId}/add-players`);
    return { success: true };
}

export async function startSession(leagueId: string) {
    const supabase = createAdminClient();
    const { userId } = await import("@clerk/nextjs/server").then(mod => mod.auth());
    if (!userId) return { error: "Unauthorized" };

    // 1. Verify operator
    const { data: league } = await supabase.from("leagues").select("operator_id, parent_league_id, status").eq("id", leagueId).single();
    if (!league) return { error: "League not found" };

    let operatorId = league.operator_id;
    if (league.parent_league_id) {
        const { data: parent } = await supabase.from("leagues").select("operator_id").eq("id", league.parent_league_id).single();
        operatorId = parent?.operator_id;
    }

    if (operatorId !== userId) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
        if (profile?.role !== 'admin') return { error: "Unauthorized" };
    }

    if (league.status === 'active') return { error: "Session is already active." };

    // 2. Check Fees
    const { data: leaguePlayers } = await supabase
        .from("league_players")
        .select("payment_status")
        .eq("league_id", leagueId);

    const unpaidPlayers = leaguePlayers?.filter(lp => lp.payment_status !== 'paid');
    if (unpaidPlayers && unpaidPlayers.length > 0) {
        return { error: "All players must pay the session fee before starting the session." };
    }

    // 3. Check if schedule exists
    const { count } = await supabase
        .from("matches")
        .select("*", { count: 'exact', head: true })
        .eq("league_id", leagueId);

    if (!count || count === 0) {
        return { error: "Please generate the schedule before starting the session." };
    }

    // 4. Update Status
    const { error } = await supabase
        .from("leagues")
        .update({ status: 'active' })
        .eq("id", leagueId);

    if (error) return { error: "Failed to start session" };

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}
