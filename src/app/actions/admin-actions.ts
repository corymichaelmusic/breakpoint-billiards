'use server'

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { auth, clerkClient } from "@clerk/nextjs/server";

// Helper to verify admin
async function verifyAdmin() {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) return { error: "Unauthorized", supabase: null };

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (profile?.role !== 'admin') {
        return { error: "Unauthorized: Admin privileges required.", supabase: null };
    }
    return { supabase, error: null };
}

export async function approveOperator(operatorId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase
        .from("profiles")
        .update({ operator_status: 'approved' })
        .eq("id", operatorId);

    if (error) {
        console.error("Error approving operator:", error);
        return { error: "Failed to approve operator." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function rejectOperator(operatorId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase
        .from("profiles")
        .update({ operator_status: 'rejected' })
        .eq("id", operatorId);

    if (error) {
        console.error("Error rejecting operator:", error);
        return { error: "Failed to reject operator." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function approveApplication(applicationId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase
        .from("operator_applications")
        .update({ status: 'approved' })
        .eq("id", applicationId);

    if (error) {
        console.error("Error approving application:", error);
        return { error: "Failed to approve application." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function rejectApplication(applicationId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase
        .from("operator_applications")
        .update({ status: 'rejected' })
        .eq("id", applicationId);

    if (error) {
        console.error("Error rejecting application:", error);
        return { error: "Failed to reject application." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function createLeagueForOperator(operatorId: string, name: string, location: string, city: string, state: string, schedule: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    // Check if operator already has a league
    const { count } = await supabase
        .from("leagues")
        .select("*", { count: 'exact', head: true })
        .eq("operator_id", operatorId)
        .eq("type", "league");

    if (count && count > 0) {
        return { error: "Operator already has a League Organization." };
    }

    const { data: newLeague, error } = await supabase
        .from("leagues")
        .insert({
            name,
            location,
            city,
            state,
            schedule_day: schedule,
            operator_id: operatorId,
            status: 'setup',
            type: 'league'
        })
        .select('id')
        .single();

    if (error || !newLeague) {
        console.error("Error creating league:", error);
        return { error: "Failed to create league." };
    }

    // Also add operator to league_operators junction table so it appears in their dashboard
    const { error: assignError } = await supabase
        .from("league_operators")
        .insert({
            league_id: newLeague.id,
            user_id: operatorId,
            role: 'admin'
        });

    if (assignError) {
        console.error("Error assigning operator to league:", assignError);
        // League was created, but assignment failed - log but don't fail the whole operation
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function updateSessionFeeStatus(sessionId: string, status: 'paid' | 'waived' | 'unpaid') {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase
        .from("leagues")
        .update({ creation_fee_status: status })
        .eq("id", sessionId);

    if (error) {
        console.error("Error updating session fee status:", error);
        return { error: "Failed to update fee status." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function updateSystemSetting(key: string, value: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase
        .from("system_settings")
        .upsert({ key, value });

    if (error) {
        console.error("Error updating system setting:", error);
        return { error: "Failed to update setting." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function deactivatePlayer(playerId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", playerId);
    if (error) {
        console.error("Error deactivating player:", error);
        return { error: "Failed to deactivate player" };
    }
    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function reactivatePlayer(playerId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase.from("profiles").update({ is_active: true }).eq("id", playerId);
    if (error) {
        console.error("Error reactivating player:", error);
        return { error: "Failed to reactivate player" };
    }
    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function deletePlayer(playerId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase.from("profiles").delete().eq("id", playerId);
    if (error) {
        console.error("Error deleting player:", error);
        // Usually fails due to FK constraints if matches exist
        if (error.code === '23503') return { error: "Cannot delete player active in matches." };
        return { error: "Failed to delete player" };
    }
    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function adminUpdateUserRole(userId: string, newRole: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);

    if (error) {
        console.error("Error updating user role:", error);
        return { error: "Failed to update role" };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function deleteApplication(applicationId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase
        .from("operator_applications")
        .delete()
        .eq("id", applicationId);

    if (error) {
        console.error("Error deleting application:", error);
        return { error: "Failed to delete application." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function deleteLeague(leagueId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    // First, delete related records from league_operators junction table
    const { error: operatorsError } = await supabase
        .from("league_operators")
        .delete()
        .eq("league_id", leagueId);

    if (operatorsError) {
        console.error("Error deleting league operators:", operatorsError);
        // Continue anyway, it might not have any operators
    }

    const { error } = await supabase
        .from("leagues")
        .delete()
        .eq("id", leagueId);

    if (error) {
        console.error("Error deleting league:", error);
        return { error: "Failed to delete league." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function archiveLeague(leagueId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    // Using 'inactive' as the archive status since we couldn't run the migration for 'archived'
    const { error } = await supabase
        .from("leagues")
        .update({ status: 'inactive' })
        .eq("id", leagueId);

    if (error) {
        console.error("Error archiving league:", error);
        return { error: "Failed to archive league." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function assignOperatorToLeague(operatorId: string, leagueId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { error } = await supabase
        .from("league_operators")
        .insert({
            league_id: leagueId,
            user_id: operatorId,
            role: 'admin'
        });

    if (error) {
        // Handle constraint violation (already assigned)
        if (error.code === '23505') {
            return { error: "Operator is already assigned to this league." };
        }
        console.error("Error assigning operator:", error);
        return { error: "Failed to assign operator." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

// ============================================
// ACCOUNT DELETION ACTIONS
// ============================================

// Player-facing: Request account deletion
export async function requestAccountDeletion(reason?: string) {
    const supabase = await createClient();
    const { userId } = await auth();

    if (!userId) return { error: "Unauthorized" };

    // Check if there's already a pending request
    const { data: existingRequest } = await supabase
        .from("deletion_requests")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "pending")
        .single();

    if (existingRequest) {
        return { error: "You already have a pending deletion request." };
    }

    const { error } = await supabase
        .from("deletion_requests")
        .insert({
            user_id: userId,
            reason: reason || null,
            status: 'pending'
        });

    if (error) {
        console.error("Error creating deletion request:", error);
        return { error: "Failed to submit deletion request." };
    }

    return { success: true };
}

// Player-facing: Cancel own deletion request
export async function cancelDeletionRequest() {
    const supabase = await createClient();
    const { userId } = await auth();

    if (!userId) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("deletion_requests")
        .update({ status: 'cancelled' })
        .eq("user_id", userId)
        .eq("status", "pending");

    if (error) {
        console.error("Error cancelling deletion request:", error);
        return { error: "Failed to cancel deletion request." };
    }

    return { success: true };
}

// Admin-facing: Cancel a deletion request
export async function adminCancelDeletionRequest(deletionRequestId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { userId: adminId } = await auth();

    const adminSupabase = createAdminClient();

    // Verify the request exists and is pending
    const { data: request, error: fetchError } = await adminSupabase
        .from("deletion_requests")
        .select("id, status")
        .eq("id", deletionRequestId)
        .single();

    if (fetchError || !request) {
        console.error("Error fetching deletion request:", fetchError);
        return { error: "Deletion request not found." };
    }

    if (request.status !== 'pending') {
        return { error: "This request has already been processed or cancelled." };
    }

    const { error } = await adminSupabase
        .from("deletion_requests")
        .update({
            status: 'cancelled',
            processed_at: new Date().toISOString(),
            processed_by: adminId
        })
        .eq("id", deletionRequestId);

    if (error) {
        console.error("Error cancelling deletion request:", error);
        return { error: "Failed to cancel deletion request." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

// Admin-facing: Process account deletion
export async function processAccountDeletion(deletionRequestId: string) {
    const { supabase, error: authError } = await verifyAdmin();
    if (authError || !supabase) return { error: authError };

    const { userId: adminId } = await auth();

    // 1. Get the deletion request and user info
    const adminSupabase = createAdminClient();
    const { data: request, error: fetchError } = await adminSupabase
        .from("deletion_requests")
        .select("id, user_id, status")
        .eq("id", deletionRequestId)
        .single();

    if (fetchError || !request) {
        console.error("Error fetching deletion request:", fetchError);
        return { error: "Deletion request not found." };
    }

    if (request.status !== 'pending') {
        return { error: "This request has already been processed." };
    }

    const targetUserId = request.user_id;

    // 2. Delete user from Clerk
    try {
        const clerk = await clerkClient();
        await clerk.users.deleteUser(targetUserId);
        console.log(`Deleted user ${targetUserId} from Clerk`);
    } catch (clerkError: any) {
        // If user doesn't exist in Clerk, continue with anonymization
        if (clerkError?.status !== 404) {
            console.error("Error deleting user from Clerk:", clerkError);
            return { error: "Failed to delete user from Clerk. Please try again." };
        }
        console.log(`User ${targetUserId} not found in Clerk, continuing with anonymization`);
    }

    // 3. Anonymize profile in Supabase
    const { error: anonymizeError } = await adminSupabase
        .from("profiles")
        .update({
            email: '*',
            phone: '*',
            full_name: '*',
            avatar_url: null,
            is_active: false,
            deleted_at: new Date().toISOString()
        })
        .eq("id", targetUserId);

    if (anonymizeError) {
        console.error("Error anonymizing profile:", anonymizeError);
        return { error: "Failed to anonymize profile data." };
    }

    // 4. Mark deletion request as processed
    const { error: updateError } = await adminSupabase
        .from("deletion_requests")
        .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            processed_by: adminId
        })
        .eq("id", deletionRequestId);

    if (updateError) {
        console.error("Error updating deletion request:", updateError);
        // Don't return error since the main deletion was successful
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}
