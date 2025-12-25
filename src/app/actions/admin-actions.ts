'use server'

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

export async function approveOperator(operatorId: string) {
    const supabase = createAdminClient();

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
    const supabase = createAdminClient();

    const { error } = await supabase
        .from("profiles")
        .update({ operator_status: 'rejected' })
        .eq("id", operatorId);

    if (error) {
        console.error("Error rejecting operator:", error);
        return { error: "Failed to reject operator." };
    }

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function approveApplication(applicationId: string) {
    const supabase = createAdminClient();

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
    const supabase = createAdminClient();

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
    const supabase = createAdminClient();

    // Check if operator already has a league
    const { count } = await supabase
        .from("leagues")
        .select("*", { count: 'exact', head: true })
        .eq("operator_id", operatorId)
        .eq("type", "league");

    if (count && count > 0) {
        return { error: "Operator already has a League Organization." };
    }

    const { error } = await supabase
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
        });

    if (error) {
        console.error("Error creating league:", error);
        return { error: "Failed to create league." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function updateSessionFeeStatus(sessionId: string, status: 'paid' | 'waived') {
    const supabase = createAdminClient();

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
    const supabase = createAdminClient();

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
    const supabase = createAdminClient();
    const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", playerId);
    if (error) {
        console.error("Error deactivating player:", error);
        return { error: "Failed to deactivate player" };
    }
    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function reactivatePlayer(playerId: string) {
    const supabase = createAdminClient();
    const { error } = await supabase.from("profiles").update({ is_active: true }).eq("id", playerId);
    if (error) {
        console.error("Error reactivating player:", error);
        return { error: "Failed to reactivate player" };
    }
    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function deletePlayer(playerId: string) {
    const supabase = createAdminClient();
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
    // 1. Verify Caller is Admin
    const { userId: callerId } = await auth();
    if (!callerId) return { error: "Unauthorized" };

    const supabase = createClient(); // Regular client to check caller's role via RLS or explicit query
    // Actually, createClient might use the cookie.
    // Better to use createAdminClient to check the caller's profile quickly, assuming we trust auth().
    const adminClient = createAdminClient();

    const { data: callerProfile } = await adminClient.from("profiles").select("role").eq("id", callerId).single();
    if (callerProfile?.role !== 'admin') {
        return { error: "Unauthorized: Admin privileges required." };
    }

    // 2. Perform Update
    const { error } = await adminClient.from("profiles").update({ role: newRole }).eq("id", userId);

    if (error) {
        console.error("Error updating user role:", error);
        return { error: "Failed to update role" };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
}

export async function deleteApplication(applicationId: string) {
    const supabase = createAdminClient();

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
