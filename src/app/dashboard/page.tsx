import { redirect } from "next/navigation";
import { getAuthProfile } from "@/utils/auth-helpers";

export default async function Dashboard() {
    const { userId, profile: userProfile } = await getAuthProfile();

    if (!userId) {
        redirect("/sign-in");
    }

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
