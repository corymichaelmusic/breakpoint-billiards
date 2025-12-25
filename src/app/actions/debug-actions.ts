'use server';

import { createAdminClient } from "@/utils/supabase/admin";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

const ALLOWED_DEBUG_USER = "user_36G4WUMW9oc8aohN8s6FQUX6Xe9"; // Cory

export async function setDebugRole(role: 'admin' | 'operator' | 'player') {
    const { userId } = await auth();

    if (userId !== ALLOWED_DEBUG_USER) {
        return { error: "Unauthorized: Debug feature only." };
    }

    const supabase = createAdminClient();

    const { error } = await supabase
        .from("profiles")
        .update({ role: role })
        .eq("id", userId);

    if (error) {
        console.error("Error setting debug role:", error);
        return { error: "Failed to update role." };
    }

    revalidatePath("/", "layout"); // Revalidate everything
    return { success: true };
}
