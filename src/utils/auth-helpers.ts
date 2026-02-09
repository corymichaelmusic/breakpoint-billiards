import { createAdminClient } from "./supabase/admin";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export type UserRole = 'admin' | 'operator' | 'player' | null;

export async function verifyUserRole(): Promise<{ userId: string; role: UserRole }> {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = createAdminClient();
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    return { userId, role: (profile?.role as UserRole) || 'player' };
}

export async function checkAdmin(): Promise<{ userId: string | null; isAdmin: boolean }> {
    const { userId } = await auth();
    if (!userId) return { userId: null, isAdmin: false };

    const supabase = createAdminClient();
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    return { userId, isAdmin: profile?.role === 'admin' };
}

export async function checkOperator(leagueId?: string): Promise<{ userId: string | null; isAuthorized: boolean }> {
    const { userId } = await auth();
    if (!userId) return { userId: null, isAuthorized: false };

    const supabase = createAdminClient();
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    if (profile?.role === 'admin') return { userId, isAuthorized: true };
    if (profile?.role !== 'operator') return { userId, isAuthorized: false };

    if (leagueId) {
        // Check if directly assigned to this league
        const { data: assignment } = await supabase
            .from("league_operators")
            .select("id")
            .eq("league_id", leagueId)
            .eq("user_id", userId)
            .single();

        if (assignment) return { userId, isAuthorized: true };

        // Check if it's a session of a league they manage
        const { data: league } = await supabase
            .from("leagues")
            .select("parent_league_id, operator_id")
            .eq("id", leagueId)
            .single();

        if (league?.operator_id === userId) return { userId, isAuthorized: true };

        if (league?.parent_league_id) {
            const { data: parentAssignment } = await supabase
                .from("league_operators")
                .select("id")
                .eq("league_id", league.parent_league_id)
                .eq("user_id", userId)
                .single();

            if (parentAssignment) return { userId, isAuthorized: true };

            const { data: parentLeague } = await supabase
                .from("leagues")
                .select("operator_id")
                .eq("id", league.parent_league_id)
                .single();

            if (parentLeague?.operator_id === userId) return { userId, isAuthorized: true };
        }

        return { userId, isAuthorized: false };
    }

    return { userId, isAuthorized: true };
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
