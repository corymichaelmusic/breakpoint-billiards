'use server';

import { createAdminClient } from "@/utils/supabase/admin";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function syncUserProfile(data: { id: string, email?: string, fullName?: string | null, imageUrl?: string, phone?: string }) {
    const supabase = createAdminClient();

    const updateData: any = {
        updated_at: new Date().toISOString()
    };

    if (data.email) updateData.email = data.email;
    if (data.fullName) updateData.full_name = data.fullName;
    if (data.imageUrl) updateData.avatar_url = data.imageUrl;
    if (data.phone) updateData.phone = data.phone;

    // Try to update first to avoid overwriting existing data fields not in updateData (like role)
    const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", data.id)
        .select("is_active")
        .single();

    if (updatedProfile) {
        return { is_active: updatedProfile.is_active };
    }

    // If update failed (likely didn't exist), insert
    const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
            id: data.id,
            ...updateData
        })
        .select("is_active")
        .single();

    if (insertError) {
        console.error("Error syncing user profile:", insertError);
        return { is_active: true };
    }

    return { is_active: newProfile?.is_active ?? true };
}

export async function updateUserRole(role: 'player' | 'operator' | 'both') {
    const { userId } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    const supabase = createAdminClient();

    // Map 'both' to 'operator' since operators can also play, and 'both' is not likely a DB enum
    const dbRole = role === 'both' ? 'operator' : role;

    // If operator/both, set status to pending
    const updates: any = { role: dbRole };
    if (role === 'operator' || role === 'both') {
        updates.operator_status = 'pending';
    }

    try {
        const { error } = await supabase.from("profiles").update(updates).eq("id", userId);

        if (error) {
            console.error("Error updating user role details:", error);
            throw new Error(`Failed to update role details: ${error.message}`);
        }
    } catch (err: any) {
        console.error("Network or Unexpected Error updating user role:", err);
        throw new Error(`Connection Error: Failed to reach database. please check your internet connection. (${err.message})`);
    }

    redirect("/dashboard");
}
