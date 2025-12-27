import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId } = await auth();

    if (!userId) {
        redirect('/sign-in');
    }

    const supabase = createAdminClient();

    // Fetch user profile securely
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    // Role-Based Access Control
    // If role is strictly 'player' (not operator or admin), DENY access
    if (profile && profile.role === 'player') {
        redirect('/unauthorized');
    }

    // If no profile found (rare edge case), likely onboarding needed, but we restrict for safety
    if (!profile) {
        redirect('/unauthorized');
    }

    // Allow Operators and Admins
    return (
        <>
            {children}
        </>
    );
}
