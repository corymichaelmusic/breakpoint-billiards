import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";

export default async function Dashboard() {
    const { userId } = await auth();

    if (!userId) {
        redirect("/sign-in");
    }

    const supabase = createAdminClient();

    // Fetch user profile to check role
    const { data: userProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    if (!userProfile || !userProfile.role) {
        redirect("/onboarding/role");
    }

    // Role-based Direction
    switch (userProfile.role) {
        case 'admin':
            redirect("/dashboard/admin");
        case 'operator':
            redirect("/dashboard/operator");
        case 'player':
        default:
            // Players are not allowed on the web dashboard
            redirect("/download");
    }
}
