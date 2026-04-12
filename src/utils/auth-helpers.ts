import { createAdminClient } from "./supabase/admin";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export type UserRole = 'admin' | 'operator' | 'player' | null;

export async function getAuthProfile() {
    const { userId } = await auth();
    if (!userId) return { userId: null, profile: null };

    const supabase = createAdminClient();
    const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, email")
        .eq("id", userId)
        .maybeSingle();

    if (profile) return { userId: profile.id as string, profile };

    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) return { userId, profile: null };

    const { data: emailProfile } = await supabase
        .from("profiles")
        .select("id, role, email")
        .eq("email", email)
        .maybeSingle();

    return { userId: (emailProfile?.id as string) || userId, profile: emailProfile };
}

export async function verifyUserRole(): Promise<{ userId: string; role: UserRole }> {
    const { userId, profile } = await getAuthProfile();
    if (!userId) redirect("/sign-in");

    return { userId, role: (profile?.role as UserRole) || 'player' };
}

export async function checkAdmin(): Promise<{ userId: string | null; isAdmin: boolean }> {
    const { userId } = await auth();
    if (!userId) return { userId: null, isAdmin: false };

    const { profile } = await getAuthProfile();

    return { userId, isAdmin: profile?.role === 'admin' };
}

export async function checkOperator(leagueId?: string): Promise<{ userId: string | null; isAuthorized: boolean }> {
    const { userId } = await auth();
    if (!userId) return { userId: null, isAuthorized: false };

    const { userId: profileUserId, profile } = await getAuthProfile();
    const effectiveUserId = profileUserId || userId;

    if (profile?.role === 'admin') return { userId: effectiveUserId, isAuthorized: true };
    if (profile?.role !== 'operator') return { userId: effectiveUserId, isAuthorized: false };

    if (leagueId) {
        const supabase = createAdminClient();
        // Check if directly assigned to this league
        const { data: assignment } = await supabase
            .from("league_operators")
            .select("id")
            .eq("league_id", leagueId)
            .eq("user_id", effectiveUserId)
            .single();

        if (assignment) return { userId: effectiveUserId, isAuthorized: true };

        // Check if it's a session of a league they manage
        const { data: league } = await supabase
            .from("leagues")
            .select("parent_league_id, operator_id")
            .eq("id", leagueId)
            .single();

        if (league?.operator_id === effectiveUserId) return { userId: effectiveUserId, isAuthorized: true };

        if (league?.parent_league_id) {
            const { data: parentAssignment } = await supabase
                .from("league_operators")
                .select("id")
                .eq("league_id", league.parent_league_id)
                .eq("user_id", effectiveUserId)
                .single();

            if (parentAssignment) return { userId: effectiveUserId, isAuthorized: true };

            const { data: parentLeague } = await supabase
                .from("leagues")
                .select("operator_id")
                .eq("id", league.parent_league_id)
                .single();

            if (parentLeague?.operator_id === effectiveUserId) return { userId: effectiveUserId, isAuthorized: true };
        }

        return { userId: effectiveUserId, isAuthorized: false };
    }

    return { userId: effectiveUserId, isAuthorized: true };
}

export async function verifyAdmin() {
    const { userId, role } = await verifyUserRole();
    if (role !== 'admin') {
        redirect("/dashboard/operator");
    }
    return { userId };
}

export async function verifyOperator(leagueId?: string) {
    const { userId, role } = await verifyUserRole();

    if (role === 'admin') return { userId, isAdmin: true };
    if (role !== 'operator') redirect("/download");

    if (leagueId) {
        const supabase = createAdminClient();

        // Check if directly assigned to this league
        const { data: assignment } = await supabase
            .from("league_operators")
            .select("id")
            .eq("league_id", leagueId)
            .eq("user_id", userId)
            .single();

        if (assignment) return { userId, isAdmin: false };

        // Check if it's a session of a league they manage
        const { data: league } = await supabase
            .from("leagues")
            .select("parent_league_id")
            .eq("id", leagueId)
            .single();

        if (league?.parent_league_id) {
            const { data: parentAssignment } = await supabase
                .from("league_operators")
                .select("id")
                .eq("league_id", league.parent_league_id)
                .eq("user_id", userId)
                .single();

            if (parentAssignment) return { userId, isAdmin: false };
        }

        // If we got here, they don't have access to this specific league
        redirect("/dashboard/operator");
    }

    return { userId, isAdmin: false };
}
