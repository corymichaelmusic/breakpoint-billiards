import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import PaymentStatusManager from "@/components/PaymentStatusManager";

import { generateSchedule, startSeason } from "@/app/actions/league-actions";
import SessionLeaderboard from "@/components/SessionLeaderboard";
import RescheduleInbox from "@/components/RescheduleInbox";
import MatchDateManager from "@/components/MatchDateManager";

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const { createAdminClient } = await import("@/utils/supabase/admin");
    const supabase = createAdminClient();

    // Fetch league details
    const { data: league } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", id)
        .single();

    if (!league) {
        return <div>League not found</div>;
    }

    const isLeagueOrg = league.type === 'league';

    // If it's a League Org, fetch its sessions
    let sessions: any[] = [];
    if (isLeagueOrg) {
        const { data: s } = await supabase
            .from("leagues")
            .select("*")
            .eq("parent_league_id", id)
            .order("created_at", { ascending: false });
        sessions = s || [];
    }

    // Fetch matches (Only if it's a session)
    const { data: matches } = !isLeagueOrg ? await supabase
        .from("matches")
        .select(`
      *,
      player1:player1_id(full_name),
      player2:player2_id(full_name)
    `)
        .eq("league_id", id)
        .order("week_number", { ascending: true })
        .order("created_at", { ascending: true }) : { data: [] };

    // Fetch pending players (Only relevant if we want to show them at org level too, but usually session level? 
    // Actually, players join the ORG, then get assigned to sessions. So pending players should be visible at ORG level.)
    // Fetch pending players for the League AND its Sessions
    const sessionIds = sessions.map(s => s.id);
    const allLeagueIds = [id, ...sessionIds];

    const { data: pendingRequests } = await supabase
        .from("league_players")
        .select("*, profiles:player_id(full_name, email), leagues:league_id(name, type)")
        .in("league_id", allLeagueIds)
        .eq("status", "pending");

    // Fetch UNPAID active players for this session (to block starting)
    const { count: unpaidPlayerCount } = await supabase
        .from("league_players")
        .select("*", { count: 'exact', head: true })
        .eq("league_id", id)
        .eq("status", "active")
        .eq("payment_status", "unpaid");

    const hasUnpaidPlayers = (unpaidPlayerCount || 0) > 0;

    const hasPending = pendingRequests && pendingRequests.length > 0;
    const hasMatches = matches && matches.length > 0;
    const isSetup = league.status === 'setup';
    const isCompleted = league.status === 'completed';

    // Fetch user profile for role check
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    const isAdmin = profile?.role === 'admin';

    // Fetch Leaderboard Data (if it's a session)
    let leaderboard: any[] = [];
    let leaderboardLimit = 25;
    let totalPlayers = 0;

    if (!isLeagueOrg) {
        const { data: settings } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "leaderboard_limit")
            .single();

        leaderboardLimit = parseInt(settings?.value || '25');

        const { getSessionLeaderboard } = await import("@/app/actions/stats-actions");
        leaderboard = await getSessionLeaderboard(id, 5);

        const { count } = await supabase
            .from("league_players")
            .select("*", { count: 'exact', head: true })
            .eq("league_id", id)
            .eq("status", "active");
        totalPlayers = count || 0;
        totalPlayers = count || 0;
    }

    // Fetch Reschedule Requests (if session)
    let rescheduleRequests: any[] = [];
    if (!isLeagueOrg) {
        const { data: reqs } = await supabase
            .from("reschedule_requests")
            .select(`
                *,
                requester:requester_id(full_name),
                match:matches!inner(
                    player1:player1_id(full_name),
                    player2:player2_id(full_name),
                    league_id
                )
            `)
            .eq("match.league_id", id)
            .eq("status", "pending_operator")
            .order('created_at', { ascending: false });
        rescheduleRequests = reqs || [];
    }

    if (isLeagueOrg) {
        return (
            <main>
                <Navbar />
                <div className="container" style={{ marginTop: "2rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                        <div>
                            <Link href="/dashboard/operator" style={{ fontSize: "0.9rem", opacity: 0.7 }}>&larr; Back to Dashboard</Link>
                            <h1 style={{ marginTop: "0.5rem" }}>{league.name}</h1>
                            <p style={{ color: "#888" }}>Organization Dashboard</p>
                        </div>
                        <div style={{ display: "flex", gap: "1rem" }}>
                            <Link href={`/dashboard/operator/leagues/${id}/sessions/new`} className="btn btn-primary">
                                + Add New Session
                            </Link>
                            <Link href={`/dashboard/operator/leagues/${id}/players`} className="btn" style={{ border: "1px solid var(--border)" }}>
                                View Players
                            </Link>
                            <Link href={`/dashboard/operator/leagues/${id}/settings`} className="btn" style={{ border: "1px solid var(--border)" }}>
                                Settings
                            </Link>
                            <Link href={`/dashboard/operator/leagues/${id}/stats`} className="btn" style={{ border: "1px solid var(--border)" }}>
                                League Stats
                            </Link>
                        </div>
                    </div>

                    {hasPending && (
                        <div className="card" style={{ marginBottom: "2rem", border: "1px solid var(--primary)" }}>
                            <h2 style={{ color: "var(--primary)", marginBottom: "1rem" }}>Pending Join Requests</h2>
                            <div style={{ display: "grid", gap: "1rem" }}>
                                {pendingRequests.map((request) => (
                                    <div key={request.id} style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "1rem",
                                        background: "var(--background)",
                                        borderRadius: "0.5rem"
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: "bold" }}>{request.profiles?.full_name || "Unknown User"}</div>
                                            <div style={{ fontSize: "0.9rem", color: "#888" }}>{request.profiles?.email}</div>
                                            <div style={{ fontSize: "0.8rem", color: "var(--primary)", marginTop: "0.25rem" }}>
                                                Requesting to join: {request.leagues?.name || "Unknown League"}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: "0.5rem" }}>
                                            <form action={async () => {
                                                'use server';
                                                const { approvePlayer } = await import("@/app/actions/league-actions");
                                                await approvePlayer(request.league_id, request.player_id);
                                            }}>
                                                <button type="submit" className="btn" style={{ background: "var(--success)", color: "#000", padding: "0.5rem 1rem", fontSize: "0.9rem" }}>Approve</button>
                                            </form>
                                            <form action={async () => {
                                                'use server';
                                                const { rejectPlayer } = await import("@/app/actions/league-actions");
                                                await rejectPlayer(request.league_id, request.player_id);
                                            }}>
                                                <button type="submit" className="btn" style={{ background: "var(--error)", color: "#fff", padding: "0.5rem 1rem", fontSize: "0.9rem" }}>Reject</button>
                                            </form>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <h2 style={{ marginBottom: "1rem" }}>Sessions</h2>
                    {sessions.length > 0 ? (
                        <div style={{ display: "grid", gap: "1rem" }}>
                            {sessions.map((session: any) => (
                                <Link key={session.id} href={`/dashboard/operator/leagues/${session.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                                    <div className="card hover-effect" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem" }}>
                                        <div>
                                            <h3 style={{ marginBottom: "0.5rem" }}>{session.name}</h3>
                                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                                <span style={{
                                                    fontSize: "0.8rem",
                                                    padding: "0.25rem 0.75rem",
                                                    borderRadius: "1rem",
                                                    background: session.status === 'active' ? 'var(--success)' : 'var(--surface)',
                                                    color: session.status === 'active' ? '#000' : 'inherit',
                                                    border: '1px solid var(--border)'
                                                }}>
                                                    {session.status.toUpperCase()}
                                                </span>
                                                {session.creation_fee_status === 'unpaid' && (
                                                    <span style={{
                                                        fontSize: "0.8rem",
                                                        padding: "0.25rem 0.75rem",
                                                        borderRadius: "1rem",
                                                        background: 'var(--error)',
                                                        color: '#fff'
                                                    }}>
                                                        Fee Unpaid
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ color: "var(--primary)" }}>
                                            Manage &rarr;
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: "#888", fontStyle: "italic" }}>No sessions found. Create one to get started.</p>
                    )}
                </div>
            </main>
        );
    }

    // Calculate Session Start Date (Based on Week 1 Matches)
    let sessionStartDate = null;
    if (matches && matches.length > 0) {
        // Find week 1 matches
        const week1Matches = matches.filter((m: any) => m.week_number === 1 && m.scheduled_date);
        if (week1Matches.length > 0) {
            // Sort by date ascending to find earliest
            week1Matches.sort((a: any, b: any) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
            sessionStartDate = new Date(week1Matches[0].scheduled_date).toLocaleDateString();
        }
    }

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                    <div>
                        <Link href="/dashboard/operator" style={{ fontSize: "0.9rem", opacity: 0.7 }}>&larr; Back to Dashboard</Link>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
                            <h1 style={{ margin: 0 }}>{league.name}</h1>
                            {sessionStartDate && (
                                <span style={{
                                    fontSize: "1rem",
                                    color: "#888",
                                    fontWeight: "normal",
                                    borderLeft: "1px solid var(--border)",
                                    paddingLeft: "1rem"
                                }}>
                                    Start: {sessionStartDate}
                                </span>
                            )}
                        </div>
                        <div style={{ marginTop: "0.5rem" }}>
                            <span style={{
                                padding: "0.25rem 0.75rem",
                                borderRadius: "1rem",
                                fontSize: "0.8rem",
                                background: isCompleted ? 'var(--success)' : 'var(--surface)',
                                border: '1px solid var(--border)',
                                color: isCompleted ? '#000' : 'inherit'
                            }}>
                                Status: {league.status.toUpperCase()}
                            </span>
                            {league.creation_fee_status === 'unpaid' && (
                                <span style={{
                                    padding: "0.25rem 0.75rem",
                                    borderRadius: "1rem",
                                    fontSize: "0.8rem",
                                    background: 'var(--error)',
                                    color: '#fff',
                                    marginLeft: '0.5rem'
                                }}>
                                    Fee Unpaid
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <Link href={`/dashboard/operator/leagues/${id}/players`} className="btn" style={{ border: '1px solid var(--border)' }}>
                            Players
                        </Link>
                        <Link href={`/dashboard/operator/leagues/${id}/stats`} className="btn" style={{ border: '1px solid var(--border)' }}>
                            Session Stats
                        </Link>

                        {!isCompleted && (
                            <>
                                {isSetup && !hasMatches && (
                                    <form action={async (formData) => {
                                        'use server';
                                        const { generateSchedule, updateLeague } = await import("@/app/actions/league-actions");

                                        const startDate = formData.get('start_date') as string;
                                        const timezone = formData.get('timezone') as string;

                                        const updates: any = {};
                                        if (startDate) updates.start_date = startDate;
                                        if (timezone) updates.timezone = timezone;

                                        if (Object.keys(updates).length > 0) {
                                            await updateLeague(id, updates);
                                        }

                                        const res = await generateSchedule(id);
                                        if (res?.error === 'NOT_ENOUGH_PLAYERS') {
                                            const parentId = league.parent_league_id;
                                            redirect(`/dashboard/operator/leagues/${parentId}/sessions/${id}/add-players`);
                                        } else if (res?.error) {
                                            console.error(res.error);
                                        }
                                    }} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <label style={{ fontSize: '0.8rem', color: '#888' }}>Start Date</label>
                                            <input
                                                type="date"
                                                name="start_date"
                                                required
                                                defaultValue={league.start_date ? new Date(league.start_date).toISOString().split('T')[0] : ''}
                                                style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '4px' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <label style={{ fontSize: '0.8rem', color: '#888' }}>Timezone</label>
                                            <select
                                                name="timezone"
                                                defaultValue={league.timezone || 'America/Chicago'}
                                                style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '4px' }}
                                            >
                                                <option value="America/New_York">Eastern Time (ET)</option>
                                                <option value="America/Chicago">Central Time (CT)</option>
                                                <option value="America/Denver">Mountain Time (MT)</option>
                                                <option value="America/Phoenix">Arizona (MT no DST)</option>
                                                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                                                <option value="America/Anchorage">Alaska Time (AKT)</option>
                                                <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                                            </select>
                                        </div>
                                        <button type="submit" className="btn btn-primary" style={{
                                            background: league.creation_fee_status === 'unpaid' ? 'var(--surface)' : 'var(--primary)',
                                            color: league.creation_fee_status === 'unpaid' ? '#888' : '#fff',
                                            cursor: league.creation_fee_status === 'unpaid' ? 'not-allowed' : 'pointer',
                                            marginTop: '1.25rem'
                                        }} disabled={league.creation_fee_status === 'unpaid'}>
                                            {league.creation_fee_status === 'unpaid' ? 'Fee Required to Schedule' : 'Generate Schedule'}
                                        </button>
                                    </form>
                                )}

                                {league.creation_fee_status === 'unpaid' && (
                                    <Link href={`/dashboard/operator/leagues/${league.parent_league_id}/sessions/${id}/pay-fee`} className="btn btn-primary">
                                        Pay Session Fee
                                    </Link>
                                )}

                                {isSetup && hasMatches && (
                                    <>
                                        <form action={async () => {
                                            'use server';
                                            const { startSession } = await import("@/app/actions/league-actions");
                                            const res = await startSession(id);
                                            if (res?.error) {
                                                console.error(res.error);
                                            }
                                        }}>
                                            <button type="submit" className="btn" style={{
                                                background: (league.creation_fee_status === 'unpaid' || hasUnpaidPlayers) ? 'var(--surface)' : 'var(--success)',
                                                color: '#fff',
                                                cursor: (league.creation_fee_status === 'unpaid' || hasUnpaidPlayers) ? 'not-allowed' : 'pointer',
                                                width: '100%',
                                                fontWeight: 'bold',
                                                opacity: (league.creation_fee_status === 'unpaid' || hasUnpaidPlayers) ? 0.5 : 1
                                            }} disabled={league.creation_fee_status === 'unpaid' || hasUnpaidPlayers}>
                                                {league.creation_fee_status === 'unpaid' ? 'Fee Required to Start' : hasUnpaidPlayers ? `Waiting for ${unpaidPlayerCount} Player(s) to Pay` : 'Start Session (Publish to Players)'}
                                            </button>
                                            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem', textAlign: 'center' }}>
                                                {hasUnpaidPlayers ? 'All players must pay their session fee before you can start.' : 'Requires all players to have paid session fee.'}
                                            </p>
                                        </form>

                                        <form action={async () => {
                                            'use server';
                                            const { resetSchedule } = await import("@/app/actions/league-actions");
                                            await resetSchedule(id);
                                        }}>
                                            <button type="submit" className="btn" style={{
                                                background: "var(--error)",
                                                color: "#fff",
                                                border: "none",
                                                marginTop: '1rem'
                                            }}>
                                                Reset Schedule
                                            </button>
                                        </form>
                                    </>
                                )}

                                {isSetup && (
                                    <Link href={`/dashboard/operator/leagues/${league.parent_league_id}/sessions/${id}/add-players`} className="btn" style={{ border: '1px solid var(--border)' }}>
                                        Manage Players
                                    </Link>
                                )}


                            </>
                        )}
                    </div>
                </div>

                {
                    hasPending && !isCompleted && (
                        <div className="card" style={{ marginBottom: "2rem", border: "1px solid var(--primary)" }}>
                            <h2 style={{ color: "var(--primary)", marginBottom: "1rem" }}>Pending Join Requests</h2>
                            <div style={{ display: "grid", gap: "1rem" }}>
                                {pendingRequests.map((request) => (
                                    <div key={request.id} style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "1rem",
                                        background: "var(--background)",
                                        borderRadius: "0.5rem"
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: "bold" }}>{request.profiles?.full_name || "Unknown User"}</div>
                                            <div style={{ fontSize: "0.9rem", color: "#888" }}>{request.profiles?.email}</div>
                                        </div>
                                        <div style={{ display: "flex", gap: "0.5rem" }}>
                                            <form action={async () => {
                                                'use server';
                                                const { approvePlayer } = await import("@/app/actions/league-actions");
                                                await approvePlayer(id, request.player_id);
                                            }}>
                                                <button type="submit" className="btn" style={{
                                                    background: "var(--success)",
                                                    color: "#000",
                                                    padding: "0.5rem 1rem",
                                                    fontSize: "0.9rem"
                                                }}>
                                                    Approve
                                                </button>
                                            </form>
                                            <form action={async () => {
                                                'use server';
                                                const { rejectPlayer } = await import("@/app/actions/league-actions");
                                                await rejectPlayer(id, request.player_id);
                                            }}>
                                                <button type="submit" className="btn" style={{
                                                    background: "var(--error)",
                                                    color: "#fff",
                                                    padding: "0.5rem 1rem",
                                                    fontSize: "0.9rem"
                                                }}>
                                                    Reject
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                }

                {!isLeagueOrg && (
                    <div style={{ marginBottom: "2rem" }}>
                        <SessionLeaderboard
                            sessionId={id}
                            sessionName={league.name}
                            initialStats={leaderboard}
                            totalPlayers={totalPlayers}
                            limit={leaderboardLimit}
                            enablePlayerLinks={true}
                        />
                    </div>
                )}

                {!isLeagueOrg && rescheduleRequests.length > 0 && (
                    <div style={{ marginBottom: "2rem" }}>
                        <RescheduleInbox requests={rescheduleRequests} userId={userId} userRole="operator" />
                    </div>
                )}

                <div className="card" style={{ marginBottom: "2rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h2>Matches</h2>
                        {league.status === 'active' && (
                            <form action={async () => {
                                'use server';
                                const { submitLeagueResults } = await import("@/app/actions/league-actions");
                                await submitLeagueResults(id);
                            }}>
                                <button type="submit" className="btn" style={{
                                    background: "var(--surface)",
                                    border: "1px solid var(--primary)",
                                    color: "var(--primary)"
                                }}>
                                    End Season & Submit Results
                                </button>
                            </form>
                        )}
                    </div>
                    {hasMatches ? (
                        <table style={{ width: "100%", marginTop: "1rem", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                                    <th style={{ padding: "0.5rem" }}>Week</th>
                                    <th style={{ padding: "0.5rem" }}>Date</th>
                                    <th style={{ padding: "0.5rem" }}>Matchup</th>
                                    <th style={{ padding: "0.5rem" }}>Status</th>
                                    <th style={{ padding: "0.5rem" }}>Scores (8-Ball / 9-Ball)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matches.map((match) => (
                                    <tr key={match.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                        <td style={{ padding: "0.5rem" }}>{match.week_number}</td>
                                        <td style={{ padding: "0.5rem", fontSize: "0.9rem" }}>
                                            <MatchDateManager
                                                matchId={match.id}
                                                initialDate={match.scheduled_date}
                                                isUnlocked={match.is_manually_unlocked}
                                            />
                                        </td>
                                        <td style={{ padding: "0.5rem" }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <PaymentStatusManager
                                                        matchId={match.id}
                                                        playerId={match.player1_id}
                                                        status={match.payment_status_p1}
                                                        playerName={match.player1?.full_name || "P1"}
                                                    />
                                                    {match.player1?.full_name || "Unknown"}
                                                </div>
                                                <div style={{ opacity: 0.5, fontSize: "0.8rem" }}>vs</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <PaymentStatusManager
                                                        matchId={match.id}
                                                        playerId={match.player2_id}
                                                        status={match.payment_status_p2}
                                                        playerName={match.player2?.full_name || "P2"}
                                                    />
                                                    {match.player2?.full_name || "Unknown"}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: "0.5rem" }}>
                                            <span style={{
                                                padding: "0.25rem 0.5rem",
                                                borderRadius: "1rem",
                                                fontSize: "0.8rem",
                                                background: match.status === 'finalized' ? 'var(--success)' : 'var(--surface-hover)',
                                                color: match.status === 'finalized' ? '#000' : 'inherit'
                                            }}>
                                                {match.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: "0.5rem" }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {(match.status === 'in_progress' || match.status === 'finalized') && (
                                                    <span style={{ fontSize: '0.9rem', marginRight: '0.5rem' }}>
                                                        {match.points_8ball_p1}-{match.points_8ball_p2} / {match.points_9ball_p1}-{match.points_9ball_p2}
                                                    </span>
                                                )}
                                                {league.status === 'active' || league.status === 'completed' ? (
                                                    <Link
                                                        href={`/dashboard/operator/leagues/${id}/matches/${match.id}/score`}
                                                        className="btn"
                                                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", border: "1px solid var(--border)" }}
                                                    >
                                                        View
                                                    </Link>
                                                ) : (
                                                    <span style={{ fontSize: "0.8rem", color: "#888", fontStyle: "italic" }}>
                                                        Session Setup
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ padding: "2rem", textAlign: "center", opacity: 0.7 }}>
                            <p>No matches scheduled yet.</p>
                            {isSetup && <p>Click "Auto-Generate Schedule" to create a 16-week round-robin season.</p>}
                        </div>
                    )}
                </div>


            </div >
        </main >
    );
}
