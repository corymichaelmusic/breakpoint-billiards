
'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/utils/supabase/admin";
import { auth } from "@clerk/nextjs/server";

export type PreregState = {
    message?: string;
    error?: string;
    success?: boolean;
};

export async function submitPreregistration(prevState: PreregState, formData: FormData): Promise<PreregState> {
    const supabase = await createClient();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;

    if (!name || !email) {
        return { error: "Please provide both name and email.", success: false };
    }

    try {
        const { error } = await supabase.from("preregistrations").insert({
            full_name: name,
            email: email
        });

        if (error) {
            console.error("Preregistration Error:", error);
            if (error.code === '23505') { // Unique violation if we had one
                return { error: "This email is already registered.", success: false };
            }
            return { error: "Something went wrong. Please try again.", success: false };
        }

        revalidatePath("/dashboard/admin");
        return { message: "You're on the list! We'll notify you when sign-up opens.", success: true };
    } catch (e) {
        return { error: "Failed to submit. Please try again.", success: false };
    }
}

export async function deletePreregistration(id: string): Promise<PreregState> {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const supabase = await createClient();

    // Verify Admin Role
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (profile?.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    const adminSupabase = createAdminClient();

    try {
        const { error } = await adminSupabase.from("preregistrations").delete().eq("id", id);
        if (error) throw error;
        revalidatePath("/dashboard/admin");
        return { success: true, message: "Deleted successfully" };
    } catch (e) {
        return { success: false, error: "Failed to delete" };
    }
}
