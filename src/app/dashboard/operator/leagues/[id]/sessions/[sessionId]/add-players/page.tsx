import { createAdminClient } from "@/utils/supabase/admin";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import AddPlayersForm from "@/components/AddPlayersForm";

import { approvePlayer, rejectPlayer } from "@/app/actions/league-actions";

export default async function AddPlayersPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
    const { id, sessionId } = await params; // id is Parent League ID
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = createAdminClient();

    // 1. Verify ownership of Parent League
    // 1. Verify ownership of Parent League
    const { data: parentLeague } = await supabase
        .from("leagues")
        .select("name, operator_id")
        .eq("id", id)
        .single();

    if (!parentLeague) redirect("/dashboard/operator");

    // Check permissions
    let hasAccess = parentLeague.operator_id === userId;

    if (!hasAccess) {
        // Check if assigned operator
        const { count } = await supabase
            .from("league_operators")
            .select("*", { count: 'exact', head: true })
            .eq("league_id", id)
            .eq("user_id", userId);

        if (count && count > 0) hasAccess = true;
    }

    if (!hasAccess) {
        // Check if global admin
        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

        if (profile?.role === 'admin') hasAccess = true;
    }

    if (!hasAccess) redirect("/dashboard/operator");

    // 2. Fetch Session Name and Status
    const { data: session } = await supabase
        .from("leagues")
        .select("name, status, reset_requested")
        .eq("id", sessionId)
        .single();

    if (!session) redirect(`/dashboard/operator/leagues/${id}`);

    // 3. Fetch All Players in Parent League Organization
    const { data: orgPlayers, error: orgError } = await supabase
        .from("league_players")
        .select("player_id, profiles!inner(full_name, email, is_active)")
        .eq("league_id", id)
        .eq("status", "active")
        .eq("profiles.is_active", true);

    if (orgError) console.error(`[AddPlayersPage] Error fetching org players:`, orgError);

    // 4. Fetch Players already in this Session (Active) with Payment Status
    const { data: sessionPlayers } = await supabase
        .from("league_players")
        .select("player_id, payment_status")
        .eq("league_id", sessionId);

    const sessionPlayerMap = new Map();
    sessionPlayers?.forEach(p => {
        sessionPlayerMap.set(p.player_id, {
            payment_status: p.payment_status
        });
    });

    // 5. Fetch Pending Requests for this Session
    const { data: pendingRequests } = await supabase
        .from("league_players")
        .select("player_id, profiles!inner(full_name, email, is_active)")
        .eq("league_id", sessionId)
        .eq("status", "pending")
        .eq("profiles.is_active", true);

    // Transform for the client component
    const players = orgPlayers?.map(p => {
        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        const sessionData = sessionPlayerMap.get(p.player_id);
        return {
            id: p.player_id,
            name: profile?.full_name || "Unknown",
            email: profile?.email || "",
            isSelected: sessionPlayerMap.has(p.player_id),
            paymentStatus: sessionData?.payment_status || 'unpaid'
        };
    }) || [];

    // Filter players if session is active (only show selected)
    const displayedPlayers = session.status !== 'setup'
        ? players.filter(p => p.isSelected)
        : players;

    const ManagePlayersList = (await import("@/components/ManagePlayersList")).default;

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "4rem", maxWidth: "800px" }}>
                <div style={{ marginBottom: '1rem' }}>
                    <Link href={`/dashboard/operator/leagues/${sessionId}`} className="btn-ghost" style={{ color: '#D4AF37' }}>
                        &larr; Back to Session
                    </Link>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
                    <h1 style={{ color: '#D4AF37' }}>Manage Players for {session?.name}</h1>
                    {session.status !== 'setup' && (
                        <form action={async () => {
                            'use server';
                            const { requestSessionReset } = await import("@/app/actions/league-actions");
                            await requestSessionReset(sessionId);
                        }}>
                            <button
                                type="submit"
                                className="btn"
                                style={{
                                    background: session.reset_requested ? '#ccc' : 'var(--error)',
                                    color: '#fff',
                                    cursor: session.reset_requested ? 'not-allowed' : 'pointer'
                                }}
                                disabled={session.reset_requested}
                            >
                                {session.reset_requested ? 'Reset Requested' : 'Request Reset'}
                            </button>
                        </form>
                    )}
                </div>

                {session.status === 'setup' && (
                    <p style={{ marginBottom: "2rem", color: "#888" }}>
                        Select players from <strong>{parentLeague.name}</strong> to include in this session.
                        Players must pay the session fee before the schedule can be generated.
                    </p>
                )}

                {pendingRequests && pendingRequests.length > 0 && (
                    <div className="card" style={{ marginBottom: "2rem", padding: "1.5rem", border: "1px solid var(--primary)" }}>
                        <h3 style={{ marginBottom: "1rem", color: "var(--primary)" }}>Pending Join Requests</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {pendingRequests.map((req) => {
                                const profile = Array.isArray(req.profiles) ? req.profiles[0] : req.profiles;
                                return (
                                    <div key={req.player_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
                                        <div>
                                            <div style={{ fontWeight: "bold", color: "white" }}>{profile?.full_name || "Unknown"}</div>
                                            <div style={{ fontSize: "0.9rem", color: "#888" }}>{profile?.email}</div>
                                        </div>
                                        <div style={{ display: "flex", gap: "0.5rem" }}>
                                            <form action={async () => {
                                                'use server';
                                                await approvePlayer(sessionId, req.player_id);
                                            }}>
                                                <button type="submit" className="btn" style={{ background: "var(--success)", color: "#fff", padding: "0.25rem 0.75rem", fontSize: "0.8rem", border: "none" }}>Approve</button>
                                            </form>
                                            <form action={async () => {
                                                'use server';
                                                await rejectPlayer(sessionId, req.player_id);
                                            }}>
                                                <button type="submit" className="btn" style={{ background: "var(--error)", color: "#fff", padding: "0.25rem 0.75rem", fontSize: "0.8rem", border: "none" }}>Reject</button>
                                            </form>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="card">
                    <ManagePlayersList
                        sessionId={sessionId}
                        players={displayedPlayers}
                        isSessionActive={session.status !== 'setup'}
                    />
                </div>
            </div>
        </main>
    );
}
