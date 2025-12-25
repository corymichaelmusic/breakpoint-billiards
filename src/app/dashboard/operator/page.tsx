import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { redirect } from "next/navigation";
import UnlockRequestAction from "@/components/UnlockRequestAction";

export default async function OperatorDashboard() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const { createAdminClient } = await import("@/utils/supabase/admin");
    const supabase = createAdminClient();

    // Check Operator Status
    const { data: profile } = await supabase
        .from("profiles")
        .select("operator_status")
        .eq("id", userId)
        .single();

    console.log("Operator Dashboard - User:", userId);
    console.log("Operator Status:", profile?.operator_status);

    if (profile?.operator_status === 'pending') {
        return (
            <main>
                <Navbar />
                <div className="container" style={{ marginTop: "4rem", textAlign: "center", maxWidth: "600px" }}>
                    <div className="card" style={{ padding: "3rem" }}>
                        <h1 style={{ fontSize: "2rem", marginBottom: "1rem", color: "var(--primary)" }}>Application Pending</h1>
                        <p style={{ color: "#888", fontSize: "1.1rem" }}>
                            Your application to become a League Operator is under review.
                        </p>
                        <p style={{ color: "#666", marginTop: "1rem", fontSize: "0.9rem" }}>
                            An administrator will review your request shortly.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    if (profile?.operator_status === 'rejected') {
        return (
            <main>
                <Navbar />
                <div className="container" style={{ marginTop: "4rem", textAlign: "center", maxWidth: "600px" }}>
                    <div className="card" style={{ padding: "3rem", border: "1px solid var(--error)" }}>
                        <h1 style={{ fontSize: "2rem", marginBottom: "1rem", color: "var(--error)" }}>Application Rejected</h1>
                        <p style={{ color: "#888", fontSize: "1.1rem" }}>
                            Your application to become a League Operator was not approved.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    // Fetch Operator's League Organizations (All of them)
    const { data: leagueOrgs, error: orgError } = await supabase
        .from("leagues")
        .select("*")
        .eq("operator_id", userId)
        .eq("type", "league")
        .order("created_at", { ascending: true });

    console.log("League Orgs Fetch:", leagueOrgs?.length, "Error:", orgError);

    // Fetch All Sessions for these leagues to check for pending requests
    const leagueIds = leagueOrgs?.map(l => l.id) || [];

    // Fetch pending requests for these leagues AND their sessions
    // We need to find all sessions that belong to these leagues first
    const { data: allSessions } = await supabase
        .from("leagues")
        .select("id, parent_league_id")
        .in("parent_league_id", leagueIds);

    const sessionIds = allSessions?.map(s => s.id) || [];
    const allRelevantIds = [...leagueIds, ...sessionIds];

    const { data: pendingRequests } = await supabase
        .from("league_players")
        .select("league_id")
        .in("league_id", allRelevantIds)
        .eq("status", "pending");

    // Map pending counts to Parent League ID
    const pendingCounts: Record<string, number> = {};

    pendingRequests?.forEach(req => {
        // Check if it's a direct league request
        if (leagueIds.includes(req.league_id)) {
            pendingCounts[req.league_id] = (pendingCounts[req.league_id] || 0) + 1;
        } else {
            // It's a session request, find the parent
            const session = allSessions?.find(s => s.id === req.league_id);
            if (session && session.parent_league_id) {
                pendingCounts[session.parent_league_id] = (pendingCounts[session.parent_league_id] || 0) + 1;
            }
        }
    });

    const { data: unlockRequests } = await supabase
        .from("reschedule_requests")
        .select(`
            *,
            match:matches!inner(
                league_id,
                week_number,
                player1:player1_id(full_name),
                player2:player2_id(full_name),
                league:league_id(
                    name,
                    parent_league:parent_league_id(name)
                )
            ),
            requester:requester_id(full_name)
        `)
        .in("match.league_id", allRelevantIds)
        .eq("status", "pending_operator");

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                    <h1>Your Leagues</h1>
                </div>

                {/* Unlock Requests Section */}
                {/* @ts-ignore */}
                {unlockRequests && unlockRequests.length > 0 && (
                    <div style={{ marginBottom: "3rem" }}>
                        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "var(--primary)" }}>Unlock Requests</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {unlockRequests.map((req) => (
                                <div key={req.id} className="card" style={{ padding: "1.5rem", borderLeft: "4px solid var(--warning)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            {/* @ts-ignore */}
                                            {req.match?.league?.parent_league?.name || 'Unknown League'}
                                        </div>
                                        <div style={{ fontSize: "0.9rem", color: "#fff", marginBottom: "0.25rem", fontWeight: "bold" }}>
                                            {/* @ts-ignore */}
                                            {req.match?.league?.name || 'Unknown Session'} • Week {req.match?.week_number}
                                        </div>
                                        <div style={{ fontWeight: "bold", marginBottom: "0.25rem", marginTop: "0.5rem" }}>
                                            {/* @ts-ignore */}
                                            {req.match?.player1?.full_name} vs {req.match?.player2?.full_name}
                                        </div>
                                        <div style={{ fontSize: "0.9rem", color: "#666" }}>
                                            Requested by: {req.requester?.full_name}
                                        </div>
                                        <div style={{ fontSize: "0.9rem", color: "#888", fontStyle: "italic", marginTop: "0.5rem" }}>
                                            "{req.reason}"
                                        </div>
                                    </div>
                                    <div>
                                        <UnlockRequestAction requestId={req.id} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {leagueOrgs && leagueOrgs.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4rem" }}>
                        {leagueOrgs.map(leagueOrg => {
                            const pendingCount = pendingCounts[leagueOrg.id] || 0;

                            return (
                                <div key={leagueOrg.id}>
                                    <Link href={`/dashboard/operator/leagues/${leagueOrg.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                        <div className="card hover-effect" style={{ marginBottom: "2rem", border: "1px solid var(--primary)", cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: "0.5rem" }}>
                                                        <h2 style={{ color: "var(--primary)", margin: 0 }}>{leagueOrg.name}</h2>
                                                        {pendingCount > 0 && (
                                                            <span style={{
                                                                background: "var(--error)",
                                                                color: "#fff",
                                                                fontSize: "0.75rem",
                                                                fontWeight: "bold",
                                                                padding: "0.25rem 0.75rem",
                                                                borderRadius: "1rem"
                                                            }}>
                                                                {pendingCount} Pending Request{pendingCount !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p style={{ color: "#888" }}>{leagueOrg.location || "No Location Set"} • {leagueOrg.schedule_day ? `${leagueOrg.schedule_day}s` : "No Schedule Day"}</p>
                                                </div>
                                                <div style={{ color: "var(--primary)" }}>
                                                    View Sessions &rarr;
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            background: 'var(--surface-hover)',
                            borderRadius: '50%',
                            margin: '0 auto 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem'
                        }}>+</div>
                        <h3 style={{ marginBottom: "0.5rem" }}>No Leagues Found</h3>
                        <p style={{ marginBottom: "2rem", color: '#888' }}>Get started by creating your first league.</p>
                        <Link href="/dashboard/operator/leagues/new" className="btn btn-primary">
                            Create League
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
