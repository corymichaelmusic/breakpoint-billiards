import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import PlayerStatsGraph from "@/components/PlayerStatsGraph";

import SessionSwitcher from "@/components/SessionSwitcher";
import SessionLeaderboard from "@/components/SessionLeaderboard";
import RescheduleInbox from "@/components/RescheduleInbox";
import RequestUnlockButton from "@/components/RequestUnlockButton";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ sessionId?: string, view?: string, latest?: string }> }) {
    const { userId } = await auth();
    const { sessionId, view, latest } = await searchParams;

    if (!userId) {
        redirect("/sign-in");
    }

    const user = await currentUser();
    // Use admin client to bypass RLS issues for dashboard data fetching
    // We trust the userId from Clerk auth()
    const supabase = createAdminClient();

    // Fetch user profile
    const { data: userProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

    if (!userProfile || !userProfile.role) {
        redirect("/onboarding/role");
    }

    if (userProfile.role === 'admin' && view !== 'player') {
        // Admins default to Operator view, Admin view is hidden
        redirect("/dashboard/operator");
    }

    // If operator and NOT explicitly asking for player view, redirect to operator dashboard
    if (userProfile.role === 'operator' && view !== 'player') {
        redirect("/dashboard/operator");
    }

    // RESTRICTED PLAYER VIEW - HANDLED BY LAYOUT
    // (Dead code removed)


    // 1. Check for League Organization Membership (to handle Pending state)
    const { data: orgMembership } = await supabase
        .from("league_players")
        .select("status, leagues!inner(type)")
        .eq("player_id", userId)
        .eq("leagues.type", "league")
        .maybeSingle();

    if (orgMembership?.status === 'pending') {
        return (
            <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Navbar />
                <div className="container" style={{ marginTop: "4rem", textAlign: "center", maxWidth: "600px" }}>
                    <div className="card" style={{ padding: "3rem" }}>
                        <h1 style={{ fontSize: "2rem", marginBottom: "1rem", color: "var(--primary)" }}>Request Pending</h1>
                        <p style={{ color: "#888", fontSize: "1.1rem" }}>
                            Your request to join the league is awaiting operator approval.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    // 2. Check for Active Session Membership
    const { data: sessionMemberships, error: sessionError } = await supabase
        .from("league_players")
        .select("league_id, status, payment_status, leagues!inner(id, name, type, status, parent_league_id, start_date, session_fee)")
        .eq("player_id", userId)
        .eq("leagues.type", "session")
        .in("leagues.status", ["setup", "active", "completed"]) // Include setup so they can pay
        .order("joined_at", { ascending: false });

    // Fetch Parent League Names manually since self-referencing embedding is tricky
    const parentLeagueIds = Array.from(new Set(
        sessionMemberships?.map(m =>
            // @ts-ignore
            Array.isArray(m.leagues) ? m.leagues[0]?.parent_league_id : m.leagues?.parent_league_id
        ).filter(Boolean) || []
    ));

    let parentLeaguesMap: Record<string, string> = {};
    if (parentLeagueIds.length > 0) {
        const { data: parents } = await supabase
            .from("leagues")
            .select("id, name")
            .in("id", parentLeagueIds);

        if (parents) {
            parents.forEach(p => {
                parentLeaguesMap[p.id] = p.name;
            });
        }
    }

    console.log("Dashboard Debug:", {
        userId,
        orgMembership,
        sessionCount: sessionMemberships?.length,
        sessionError,
        firstSession: sessionMemberships?.[0]
    });

    // Determine active session based on URL param OR auto-select
    let activeSession = null;

    // If explicitly asking for list view, don't auto-select
    if (view === 'list') {
        activeSession = null;
    } else if (sessionId && sessionMemberships) {
        activeSession = sessionMemberships.find(s => s.league_id === sessionId);
    } else if (sessionMemberships && sessionMemberships.length > 0) {
        // Auto-select priority: Active > Setup > Completed
        // Sort is already by joined_at, let's find the first active/setup one
        activeSession = sessionMemberships.find(s =>
            // @ts-ignore
            (Array.isArray(s.leagues) ? s.leagues[0] : s.leagues).status === 'active'
        ) || sessionMemberships.find(s =>
            // @ts-ignore
            (Array.isArray(s.leagues) ? s.leagues[0] : s.leagues).status === 'setup'
        ) || sessionMemberships[0]; // Fallback to most recent
    }

    // If no specific session selected, show the League List (Hub View)
    if (!activeSession) {
        // If in Org but not Session
        if (!sessionMemberships || sessionMemberships.length === 0) {
            if (orgMembership?.status === 'active') {
                return (
                    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                        <Navbar />
                        <div className="container" style={{ marginTop: "4rem", textAlign: "center", maxWidth: "600px" }}>
                            <div className="card" style={{ padding: "3rem" }}>
                                <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Welcome to Breakpoint</h1>
                                <p style={{ color: "#888", marginBottom: "1rem" }}>
                                    You are a member of the league organization, but not assigned to an active session yet.
                                </p>
                                <p style={{ color: "#666", fontSize: "0.9rem" }}>
                                    Contact your League Operator to be added to the upcoming session.
                                </p>
                                {/* Join New Session */}
                                <div style={{ marginTop: "3rem", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "2rem" }}>
                                    <p style={{ color: "#888", marginBottom: "1rem" }}>Looking to play more?</p>
                                    <Link href="/dashboard/join-session">
                                        <button className="btn btn-secondary">
                                            Join Another Session
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </main>
                );
            }
            redirect("/dashboard/join-league");
        }

        // Render League List
        return (
            <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Navbar />
                <div className="container" style={{ marginTop: "2rem", paddingBottom: "4rem" }}>
                    <div style={{ marginBottom: "2rem" }}>
                        <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--primary)" }}>
                            Your Sessions
                        </h1>
                        <p style={{ color: "#888" }}>Select a session to view your stats and matches.</p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
                        {sessionMemberships.map((membership) => {
                            // @ts-ignore
                            const league = Array.isArray(membership.leagues) ? membership.leagues[0] : membership.leagues;
                            const isPending = membership.status === 'pending';
                            const parentName = league?.parent_league_id ? parentLeaguesMap[league.parent_league_id] : null;

                            return (
                                <Link
                                    key={membership.league_id}
                                    href={isPending ? '#' : `/dashboard?sessionId=${membership.league_id}&view=player`}
                                    style={{ textDecoration: 'none', color: 'inherit', pointerEvents: isPending ? 'none' : 'auto' }}
                                >
                                    <div className="card hover-effect" style={{
                                        padding: "2rem",
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                        opacity: isPending ? 0.7 : 1
                                    }}>
                                        <div>
                                            <div style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "flex-start",
                                                marginBottom: "1rem"
                                            }}>
                                                <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", margin: 0 }}>
                                                    {league?.name}
                                                </h3>
                                                {isPending && (
                                                    <span style={{
                                                        fontSize: "0.75rem",
                                                        padding: "0.25rem 0.75rem",
                                                        background: "#fff3cd",
                                                        color: "#856404",
                                                        borderRadius: "1rem",
                                                        border: "1px solid #ffeeba"
                                                    }}>
                                                        PENDING
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                {parentName && (
                                                    <p style={{ color: "var(--primary)", fontSize: "0.9rem", fontWeight: "500" }}>
                                                        {parentName}
                                                    </p>
                                                )}
                                                <p style={{ color: "#888", fontSize: "0.9rem" }}>
                                                    {league?.status.toUpperCase()}
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
                                            <span style={{ color: "var(--primary)", fontSize: "0.9rem", fontWeight: "600" }}>
                                                {isPending ? "Awaiting Approval" : "View Dashboard \u2192"}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Join New Session */}
                    <div style={{ marginTop: "3rem", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "2rem" }}>
                        <p style={{ color: "#888", marginBottom: "1rem" }}>Looking to play more?</p>
                        <Link href="/dashboard/join-session">
                            <button className="btn btn-secondary">
                                Join Another Session
                            </button>
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    // @ts-ignore
    const leagueName = Array.isArray(activeSession.leagues) ? activeSession.leagues[0]?.name : activeSession.leagues?.name;

    // Check for Pending Session Status
    if (activeSession.status === 'pending') {
        return (
            <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Navbar />
                <div className="container" style={{ marginTop: "4rem", textAlign: "center", maxWidth: "600px" }}>
                    <div className="card" style={{ padding: "3rem" }}>
                        <h1 style={{ fontSize: "2rem", marginBottom: "1rem", color: "var(--primary)" }}>Session Request Pending</h1>
                        <p style={{ color: "#888", fontSize: "1.1rem" }}>
                            Your request to join <strong>{leagueName}</strong> is awaiting operator approval.
                        </p>
                        {/* Join New Session */}
                        <div style={{ marginTop: "3rem", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "2rem" }}>
                            <p style={{ color: "#888", marginBottom: "1rem" }}>Looking to play more?</p>
                            <Link href="/dashboard/join-session">
                                <button className="btn btn-secondary">
                                    Join Another Session
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // 3. Check Payment Status for Session (Non-blocking now)
    const isUnpaid = activeSession.payment_status === 'unpaid';

    // 4. Fetch Lifetime Stats & Session Stats
    const { getPlayerLifetimeStats, getPlayerBreakpointHistory, calculatePlayerRating, getPlayerSessionStats } = await import("@/app/actions/stats-actions");
    const lifetimeStats = await getPlayerLifetimeStats(userId);
    const statsHistory = await getPlayerBreakpointHistory(userId);
    const playerRating = await calculatePlayerRating(userId);

    // Fetch Session Stats (using robust aggregation)
    const sessionStats = await getPlayerSessionStats(userId, activeSession.league_id);
    const winRate = sessionStats.winRate;
    const sessionPPM = sessionStats.pointsPerMatch;
    const wins = sessionStats.matchesWon;
    const losses = sessionStats.matchesLost;
    const sessionTotalPoints = sessionStats.totalPoints;

    // 5. Fetch Next Match for the REAL Current Session (Active/Setup)
    // Prioritize ACTIVE sessions. If none, show SETUP.
    let realCurrentSession = sessionMemberships?.find(s =>
        // @ts-ignore
        (Array.isArray(s.leagues) ? s.leagues[0] : s.leagues).status === 'active'
    );

    if (!realCurrentSession) {
        realCurrentSession = sessionMemberships?.find(s =>
            // @ts-ignore
            (Array.isArray(s.leagues) ? s.leagues[0] : s.leagues).status === 'setup'
        );
    }

    let nextMatch = null;
    // Only show matches if the session is active
    // @ts-ignore
    const isSessionActive = (Array.isArray(realCurrentSession?.leagues) ? realCurrentSession.leagues[0] : realCurrentSession?.leagues)?.status === 'active';

    if (realCurrentSession && isSessionActive) {
        const { data: upcomingMatches } = await supabase
            .from("matches")
            .select(`
                *,
                player1:player1_id(full_name),
                player2:player2_id(full_name)
            `)
            .eq("league_id", realCurrentSession.league_id)
            .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
            .in("status", ["scheduled", "in_progress"])
            .order("week_number", { ascending: true })
            .limit(1);

        if (upcomingMatches && upcomingMatches.length > 0) {
            nextMatch = upcomingMatches[0];
        }
    }

    let nextMatchLockStatus: { locked: boolean; reason?: string } = { locked: false };
    if (nextMatch) {
        const { checkMatchLock } = await import("@/app/actions/match-actions");
        nextMatchLockStatus = await checkMatchLock(nextMatch.id);
    }

    // 6. Fetch Leaderboard Data
    const { data: settings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "leaderboard_limit")
        .single();

    const leaderboardLimit = parseInt(settings?.value || '25');

    const { getSessionLeaderboard } = await import("@/app/actions/stats-actions");
    const leaderboard = await getSessionLeaderboard(activeSession.league_id, 5);

    const { count: totalPlayers } = await supabase
        .from("league_players")
        .select("*", { count: 'exact', head: true })
        .eq("league_id", activeSession.league_id)
        .eq("league_id", activeSession.league_id)
        .eq("status", "active");

    // 7. Fetch Reschedule Requests (for matches I am involved in)
    const { data: rescheduleRequests } = await supabase
        .from("reschedule_requests")
        .select(`
            *,
            requester:requester_id(full_name),
            match:matches!inner(
                player1:player1_id(full_name),
                player2:player2_id(full_name),
                player1_id,
                player2_id
            )
        `)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`, { foreignTable: 'matches' })
        .order('created_at', { ascending: false });

    return (
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem", paddingBottom: "4rem" }}>

                <Link href="/dashboard?view=list" style={{ fontSize: "0.9rem", opacity: 0.7, display: 'block', marginBottom: '1rem' }}>
                    &larr; Back to Sessions
                </Link>

                {/* Pending Requests Banner */}
                {sessionMemberships?.filter(s => s.status === 'pending').map(pendingSession => {
                    // @ts-ignore
                    const leagueName = Array.isArray(pendingSession.leagues) ? pendingSession.leagues[0]?.name : pendingSession.leagues?.name;
                    return (
                        <div key={pendingSession.league_id} style={{
                            background: "#fff3cd",
                            color: "#856404",
                            padding: "1rem",
                            borderRadius: "var(--radius)",
                            marginBottom: "1rem",
                            border: "1px solid #ffeeba",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem"
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <div>
                                <strong>Request Pending:</strong> Your request to join <strong>{leagueName}</strong> is awaiting operator approval.
                            </div>
                        </div>
                    );
                })}

                {/* Session Switcher */}
                {/* @ts-ignore */}
                <SessionSwitcher sessions={sessionMemberships} currentSessionId={activeSession.league_id} />

                {/* Reschedule Inbox */}
                {/* @ts-ignore */}
                <RescheduleInbox requests={rescheduleRequests || []} userId={userId} userRole={userProfile.role} />

                {/* Payment Banner */}
                {isUnpaid && (
                    <div style={{
                        background: "#fff3cd",
                        color: "#856404",
                        padding: "1rem",
                        borderRadius: "var(--radius)",
                        marginBottom: "2rem",
                        border: "1px solid #ffeeba",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.5rem"
                    }}>
                        <div>
                            {/* @ts-ignore */}
                            <strong>Action Required:</strong> Please pay your session fee of <strong>${(Array.isArray(activeSession.leagues) ? activeSession.leagues[0] : activeSession.leagues).session_fee || 0}</strong> for {leagueName}.
                        </div>
                        <button className="btn btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}>
                            Pay Now
                        </button>
                    </div>
                )}

                <div style={{ marginBottom: "2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                        <h1 style={{ fontSize: "2rem", fontWeight: "bold", margin: 0, color: "var(--primary)" }}>
                            {leagueName}
                        </h1>
                        {/* @ts-ignore */}
                        {(Array.isArray(activeSession.leagues) ? activeSession.leagues[0] : activeSession.leagues).status === 'completed' && (
                            <span style={{
                                fontSize: "0.8rem",
                                padding: "0.25rem 0.75rem",
                                background: "#333",
                                color: "#fff",
                                borderRadius: "1rem",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                fontWeight: "600"
                            }}>
                                Ended
                            </span>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: "1rem", color: "#888", fontSize: "0.9rem" }}>
                        <p>Player Dashboard</p>
                        {/* @ts-ignore */}
                        {(Array.isArray(activeSession.leagues) ? activeSession.leagues[0] : activeSession.leagues).start_date && (
                            <>
                                <span>•</span>
                                <p>Starts: {new Date((Array.isArray(activeSession.leagues) ? activeSession.leagues[0] : activeSession.leagues).start_date).toLocaleDateString()}</p>
                            </>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                    {/* Session Stats */}
                    <div style={{ minWidth: 0 }}>
                        <Link href={`/dashboard/session/${activeSession.league_id}${view === 'player' ? '?view=player' : ''}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
                            <div className="card hover-effect" style={{ textAlign: "center", padding: "0.5rem 0.25rem", border: "1px solid var(--primary)", cursor: "pointer", transition: "transform 0.2s", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
                                <div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem" }}>
                                        <div style={{ overflow: "hidden" }}>
                                            <p style={{ fontSize: "0.6rem", color: "#888", marginBottom: "0.1rem" }}>Win Rate</p>
                                            <p style={{ fontSize: "1.1rem", fontWeight: "bold", margin: 0, color: "var(--primary)" }}>{winRate}%</p>
                                        </div>
                                        <div style={{ overflow: "hidden" }}>
                                            <p style={{ fontSize: "0.6rem", color: "#888", marginBottom: "0.1rem" }}>PPM</p>
                                            <p style={{ fontSize: "1.1rem", fontWeight: "bold", margin: 0 }}>{sessionPPM}</p>
                                        </div>
                                        <div style={{ overflow: "hidden" }}>
                                            <p style={{ fontSize: "0.6rem", color: "#888", marginBottom: "0.1rem" }}>Matches</p>
                                            <div style={{ fontSize: "0.8rem", fontWeight: "bold", margin: 0, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "2px" }}>
                                                <span style={{ color: "var(--primary)" }}>{wins}W</span>
                                                <span style={{ color: "#666" }}>-</span>
                                                <span style={{ color: "#fff" }}>{losses}L</span>
                                            </div>
                                        </div>
                                        <div style={{ overflow: "hidden" }}>
                                            <p style={{ fontSize: "0.6rem", color: "#888", marginBottom: "0.1rem" }}>Tot Pts</p>
                                            <p style={{ fontSize: "1rem", fontWeight: "bold", margin: 0 }}>{sessionTotalPoints}</p>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: "0.5rem", fontSize: "0.6rem", color: "var(--primary)", fontWeight: "600" }}>
                                    View Session &rarr;
                                </div>
                            </div>
                        </Link>
                    </div>

                    {/* Lifetime Stats */}
                    <div style={{ minWidth: 0 }}>
                        <Link href="/dashboard/history" style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
                            <div className="card hover-effect" style={{ textAlign: "center", padding: "0.5rem 0.25rem", cursor: "pointer", transition: "transform 0.2s", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
                                <div>
                                    <div style={{
                                        display: "inline-block",
                                        padding: "0.1rem 0.4rem",
                                        background: "var(--surface-hover)",
                                        borderRadius: "1rem",
                                        fontSize: "0.6rem",
                                        marginBottom: "0.5rem",
                                        color: "#888",
                                        fontWeight: "600"
                                    }}>
                                        LIFETIME
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem" }}>
                                        <div style={{ overflow: "hidden" }}>
                                            <p style={{ fontSize: "0.6rem", color: "#888", marginBottom: "0.1rem" }}>Win Rate</p>
                                            <p style={{ fontSize: "1.1rem", fontWeight: "bold", margin: 0, color: "var(--primary)" }}>{lifetimeStats?.winRate || 0}%</p>
                                        </div>
                                        <div style={{ overflow: "hidden" }}>
                                            <p style={{ fontSize: "0.6rem", color: "#888", marginBottom: "0.1rem" }}>PPM</p>
                                            <p style={{ fontSize: "1.1rem", fontWeight: "bold", margin: 0 }}>{lifetimeStats?.pointsPerMatch || 0}</p>
                                        </div>
                                        <div style={{ overflow: "hidden" }}>
                                            <p style={{ fontSize: "0.6rem", color: "#888", marginBottom: "0.1rem" }}>Matches</p>
                                            <div style={{ fontSize: "0.8rem", fontWeight: "bold", margin: 0, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "2px" }}>
                                                <span style={{ color: "var(--primary)" }}>{lifetimeStats?.matchesWon}W</span>
                                                <span style={{ color: "#666" }}>-</span>
                                                <span style={{ color: "#fff" }}>{lifetimeStats?.matchesLost}L</span>
                                            </div>
                                        </div>
                                        <div style={{ overflow: "hidden" }}>
                                            <p style={{ fontSize: "0.6rem", color: "#888", marginBottom: "0.1rem" }}>Tot Pts</p>
                                            <p style={{ fontSize: "1rem", fontWeight: "bold", margin: 0 }}>{lifetimeStats?.totalPoints}</p>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: "0.5rem", fontSize: "0.6rem", color: "var(--primary)", fontWeight: "600" }}>
                                    View History &rarr;
                                </div>
                            </div>
                        </Link>
                    </div>

                    {/* Fargo Rating */}
                    <div className="card" style={{ textAlign: "center", padding: "1.5rem 1rem", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <h3 style={{ color: "#888", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Fargo Rating</h3>
                        <div style={{ fontSize: "2.5rem", fontWeight: "800", color: "var(--foreground)" }}>{userProfile.fargo_rating || 'N/A'}</div>
                        <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.5rem" }}>Current Rating</p>
                    </div>

                    {/* Unique Player Rating (Breakpoint) */}
                    <div className="card" style={{
                        textAlign: "center",
                        padding: "1.5rem 1rem",
                        background: "linear-gradient(135deg, var(--surface), var(--surface-hover))",
                        minWidth: 0,
                        display: "flex", flexDirection: "column", justifyContent: "center"
                    }}>
                        <h3 style={{ color: "var(--primary)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Breakpoint</h3>
                        <div style={{ fontSize: "2.5rem", fontWeight: "800", color: "var(--primary)" }}>{playerRating}</div>
                        <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.5rem" }}>Level (1-10)</p>
                    </div>

                </div>

                {/* Leaderboard */}
                <div style={{ marginBottom: "3rem" }}>
                    <SessionLeaderboard
                        sessionId={activeSession.league_id}
                        // @ts-ignore
                        sessionName={(Array.isArray(activeSession.leagues) ? activeSession.leagues[0] : activeSession.leagues).name}
                        initialStats={leaderboard}
                        totalPlayers={totalPlayers || 0}
                        limit={leaderboardLimit}
                    />
                </div>

                {/* Progress Graph */}
                <div style={{ marginBottom: "3rem" }}>
                    <PlayerStatsGraph data={statsHistory} />
                </div>

                {/* Next Match (Always from Current Active Session) */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                    <h2 id="upcoming-matches" style={{ fontSize: "1.5rem", margin: 0 }}>Next Match</h2>
                    {realCurrentSession && (
                        <Link href={`/dashboard/upcoming${view === 'player' ? '?view=player' : ''}`} style={{ fontSize: "0.9rem", color: "var(--primary)" }}>
                            View All Upcoming Matches &rarr;
                        </Link>
                    )}
                </div>

                {nextMatch ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {(() => {
                            const match = nextMatch;
                            const opponent = match.player1_id === userId ? match.player2 : match.player1;
                            const isLocked = nextMatchLockStatus.locked;

                            return (
                                <div key={match.id} className="card next-match-card">
                                    <div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            {/* @ts-ignore */}
                                            {parentLeaguesMap[(realCurrentSession.leagues[0] || realCurrentSession.leagues).parent_league_id]}
                                        </div>
                                        <div style={{ fontSize: "0.9rem", color: "#fff", marginBottom: "0.25rem", fontWeight: "bold" }}>
                                            {/* @ts-ignore */}
                                            {(realCurrentSession.leagues[0] || realCurrentSession.leagues).name}
                                        </div>
                                        <div style={{ fontSize: "0.9rem", color: "#888", marginBottom: "0.25rem" }}>
                                            Week {match.week_number} • {match.scheduled_date ? new Date(match.scheduled_date).toLocaleDateString() : 'TBD'}
                                        </div>
                                        <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                                            vs {opponent?.full_name || 'Unknown'}
                                        </div>
                                    </div>
                                    <div>
                                        {/* Logic to determine if locked */}
                                        {isLocked ? (
                                            <button className="btn btn-disabled" disabled style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem", opacity: 0.6, cursor: 'not-allowed' }}>
                                                Locked
                                            </button>
                                        ) : (
                                            <Link href={`/dashboard/matches/${match.id}/play`}>
                                                <button className="btn btn-primary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}>
                                                    {match.status === 'in_progress' ? 'Continue' : 'Play'}
                                                </button>
                                            </Link>
                                        )}
                                        <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                                            <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                                                <RequestUnlockButton
                                                    matchId={match.id}
                                                    isLocked={isLocked}
                                                    // @ts-ignore
                                                    hasPendingRequest={rescheduleRequests?.some(r => r.match_id === match.id && r.status === 'pending_operator')}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <div className="card" style={{ padding: "3rem", textAlign: "center", color: "#888" }}>
                        {realCurrentSession && !isSessionActive ? (
                            <p>Session has not started yet. Matches will appear once the operator starts the session.</p>
                        ) : (
                            <p>No upcoming matches scheduled.</p>
                        )}
                    </div>
                )}
                {/* Join New Session */}
                <div style={{ marginTop: "3rem", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "2rem" }}>
                    <p style={{ color: "#888", marginBottom: "1rem" }}>Looking to play more?</p>
                    <Link href="/dashboard/join-session">
                        <button className="btn btn-secondary">
                            Join Another Session
                        </button>
                    </Link>
                </div>
            </div>
        </main>
    );
}
