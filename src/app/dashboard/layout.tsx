import { redirect } from "next/navigation";
import { getAuthProfile } from "@/utils/auth-helpers";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId, profile } = await getAuthProfile();

    if (!userId) {
        redirect('/sign-in');
    }

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
