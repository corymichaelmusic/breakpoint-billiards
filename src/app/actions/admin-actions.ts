'use server'

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

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
