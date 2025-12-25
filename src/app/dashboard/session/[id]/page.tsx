import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import RequestUnlockButton from "@/components/RequestUnlockButton";

export const dynamic = "force-dynamic";

export default async function SessionMatchesPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ view?: string, filter?: string }> }) {
    const { userId } = await auth();
    const { id: sessionId } = await params;
    const { view, filter } = await searchParams;

    if (!userId) {
        redirect("/sign-in");
    }

    const supabase = await createClient();

    // Fetch session details
    const { data: session } = await supabase
        .from("leagues")
        .select("name, status, timezone")
        .eq("id", sessionId)
        .single();

    // Build query for matches
    let query = supabase
        .from("matches")
        .select(`
            *,
            player1:player1_id(full_name),
            player2:player2_id(full_name),
            is_manually_unlocked,
            reschedule_requests(status)
        `)
        .eq("league_id", sessionId)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .order('scheduled_date', { ascending: true });

    if (filter === 'upcoming') {
        query = query.eq('status', 'scheduled');
    }

    const { data: matches } = await query;

    const backLink = view === 'player'
        ? `/dashboard?sessionId=${sessionId}&view=player`
        : `/dashboard?sessionId=${sessionId}`;

    return (
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem", paddingBottom: "4rem", maxWidth: "800px" }}>
                <Link href={backLink} style={{ fontSize: "0.9rem", opacity: 0.7, display: 'block', marginBottom: '1rem' }}>
                    &larr; Back to Dashboard
                </Link>

                <div style={{ marginBottom: "2rem" }}>
                    <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--primary)" }}>
                        {session?.name || 'Session'} {filter === 'upcoming' ? 'Upcoming Matches' : 'Matches'}
                    </h1>
                    <p style={{ color: "#888" }}>
                        {filter === 'upcoming' ? 'Your scheduled matches for this session.' : 'All matches for this session.'}
                    </p>
                </div>

                {session?.status === 'setup' ? (
                    <div className="card" style={{ padding: "3rem", textAlign: "center", color: "#888" }}>
                        <p style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Session Has Not Started</p>
                        <p>The operator has not started this session yet. Matches will appear here once the session is active.</p>
                    </div>
                ) : matches && matches.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {matches.map((match) => {
                            // Calculate winner and scores dynamically
                            const isPlayer1 = match.player1_id === userId;
                            const myPoints = isPlayer1 ? match.current_points_p1 : match.current_points_p2;
                            const oppPoints = isPlayer1 ? match.current_points_p2 : match.current_points_p1;

                            // Determine winner: Use winner_id if present, otherwise compare points
                            let isWinner = false;
                            if (match.winner_id) {
                                isWinner = match.winner_id === userId;
                            } else {
                                isWinner = myPoints > oppPoints;
                            }

                            const opponent = isPlayer1 ? match.player2 : match.player1;
                            const isFinalized = match.status === 'finalized';

                            return (
                                <div key={match.id} className="card" style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "1.5rem",
                                    borderLeft: isFinalized ? (isWinner ? "4px solid var(--success)" : "4px solid var(--error)") : "4px solid var(--border)"
                                }}>
                                    <div>
                                        <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            Week {match.week_number} • {match.scheduled_date ? new Date(match.scheduled_date).toLocaleDateString() : 'TBD'}
                                        </div>
                                        <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                                            vs {opponent?.full_name || 'Unknown'}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        {isFinalized ? (
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                                                    {/* 8-Ball Result */}
                                                    {match.status_8ball === 'finalized' && (
                                                        <div style={{ fontSize: "0.9rem" }}>
                                                            <span style={{ color: "#888", marginRight: "0.5rem" }}>8-Ball:</span>
                                                            <span style={{
                                                                fontWeight: "bold",
                                                                color: (match.winner_id_8ball ? match.winner_id_8ball === userId : (isPlayer1 ? match.points_8ball_p1 > match.points_8ball_p2 : match.points_8ball_p2 > match.points_8ball_p1)) ? "var(--success)" : "var(--error)"
                                                            }}>
                                                                {(match.winner_id_8ball ? match.winner_id_8ball === userId : (isPlayer1 ? match.points_8ball_p1 > match.points_8ball_p2 : match.points_8ball_p2 > match.points_8ball_p1)) ? "WIN" : "LOSS"}
                                                            </span>
                                                            <span style={{ marginLeft: "0.5rem", color: "#666" }}>
                                                                ({isPlayer1 ? match.points_8ball_p1 : match.points_8ball_p2}-{isPlayer1 ? match.points_8ball_p2 : match.points_8ball_p1})
                                                            </span>
                                                        </div>
                                                    )}
                                                    {/* 9-Ball Result */}
                                                    {match.status_9ball === 'finalized' && (
                                                        <div style={{ fontSize: "0.9rem" }}>
                                                            <span style={{ color: "#888", marginRight: "0.5rem" }}>9-Ball:</span>
                                                            <span style={{
                                                                fontWeight: "bold",
                                                                color: (match.winner_id_9ball ? match.winner_id_9ball === userId : (isPlayer1 ? match.points_9ball_p1 > match.points_9ball_p2 : match.points_9ball_p2 > match.points_9ball_p1)) ? "var(--success)" : "var(--error)"
                                                            }}>
                                                                {(match.winner_id_9ball ? match.winner_id_9ball === userId : (isPlayer1 ? match.points_9ball_p1 > match.points_9ball_p2 : match.points_9ball_p2 > match.points_9ball_p1)) ? "WIN" : "LOSS"}
                                                            </span>
                                                            <span style={{ marginLeft: "0.5rem", color: "#666" }}>
                                                                ({isPlayer1 ? match.points_9ball_p1 : match.points_9ball_p2}-{isPlayer1 ? match.points_9ball_p2 : match.points_9ball_p1})
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <Link href={`/dashboard/matches/${match.id}/play`}>
                                                    <button className="btn btn-secondary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}>
                                                        View Match
                                                    </button>
                                                </Link>
                                            </div>
                                        ) : match.status === 'scheduled' ? (
                                            (() => {
                                                const timezone = session?.timezone || 'America/Chicago';

                                                // Check manual override first
                                                if (match.is_manually_unlocked) {
                                                    return (
                                                        <Link href={`/dashboard/matches/${match.id}/play`}>
                                                            <button className="btn btn-primary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}>
                                                                Play
                                                            </button>
                                                        </Link>
                                                    );
                                                }

                                                if (!match.scheduled_date) {
                                                    // If no date, maybe allow? Or lock? Assuming allow if active but no specific date set yet?
                                                    // Or default to locked if strict?
                                                    // Let's assume unlocked if TBD for now, or maybe locked? 
                                                    // User said "matches should automatically unlock...". If no date, impossible to define window.
                                                    // Let's assume unlocked to avoid blocking unscheduled matches in casual leagues.
                                                    return (
                                                        <Link href={`/dashboard/matches/${match.id}/play`}>
                                                            <button className="btn btn-primary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}>
                                                                Play
                                                            </button>
                                                        </Link>
                                                    );
                                                }

                                                // Calculate Window
                                                const now = new Date();
                                                const nowInLeagueTimeStr = now.toLocaleString("en-US", { timeZone: timezone });
                                                const nowInLeagueTime = new Date(nowInLeagueTimeStr);

                                                const scheduledDate = new Date(match.scheduled_date);
                                                // Handle potential parsing errors or different formats appropriately
                                                // If valid date, get year/month/day
                                                let startWindow, endWindow;

                                                if (!isNaN(scheduledDate.getTime())) {
                                                    // Note: new Date("YYYY-MM-DD") is UTC. "MM/DD/YYYY" is Local.
                                                    // We want the components regardless of timezone shift, assuming input implies "Goal Day".
                                                    // If input is YYYY-MM-DD, it's UTC. getUTCFullYear() etc. gives 2025, 12, 05.
                                                    // If input is MM/DD/YYYY, it's Local. getFullYear() gives 2025...

                                                    // Let's assume input string is ISO-like (YYYY-MM-DD) which is standard for postgres date.
                                                    // We'll treat the date components as the target day in the target timezone.

                                                    // Use UTC methods to extract strict YMD from YYYY-MM-DD string to avoid timezone shift
                                                    // (e.g. 2025-01-01 is Dec 31 in CST if using local methods on a UTC date)
                                                    const parts = match.scheduled_date.split('T')[0].split(/[-/]/);
                                                    let year, month, day;
                                                    if (parts.length === 3) {
                                                        if (parts[0].length === 4) {
                                                            // YYYY-MM-DD
                                                            [year, month, day] = parts.map(Number);
                                                        } else {
                                                            // MM/DD/YYYY?
                                                            [month, day, year] = parts.map(Number);
                                                        }
                                                    } else {
                                                        // Fallback
                                                        year = scheduledDate.getFullYear();
                                                        month = scheduledDate.getMonth() + 1;
                                                        day = scheduledDate.getDate();
                                                    }

                                                    startWindow = new Date(year, month - 1, day, 8, 0, 0);
                                                    endWindow = new Date(startWindow);
                                                    endWindow.setDate(endWindow.getDate() + 1);

                                                    const isLocked = nowInLeagueTime < startWindow || nowInLeagueTime >= endWindow;

                                                    return (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                            {isLocked ? (
                                                                <button className="btn" disabled style={{
                                                                    padding: "0.25rem 0.75rem",
                                                                    fontSize: "0.8rem",
                                                                    background: "var(--surface)",
                                                                    color: "#888",
                                                                    cursor: "not-allowed",
                                                                    border: "1px solid var(--border)"
                                                                }}>
                                                                    Locked
                                                                </button>
                                                            ) : (
                                                                <Link href={`/dashboard/matches/${match.id}/play`}>
                                                                    <button className="btn btn-primary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}>
                                                                        Play
                                                                    </button>
                                                                </Link>
                                                            )}
                                                            <RequestUnlockButton
                                                                matchId={match.id}
                                                                isLocked={isLocked}
                                                                // @ts-ignore
                                                                hasPendingRequest={match.reschedule_requests?.some(r => r.status === 'pending_operator')}
                                                            />
                                                        </div>
                                                    );
                                                } else {
                                                    // Invalid date, allow play? or lock?
                                                    return (
                                                        <Link href={`/dashboard/matches/${match.id}/play`}>
                                                            <button className="btn btn-primary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}>
                                                                Play
                                                            </button>
                                                        </Link>
                                                    );
                                                }
                                            })()
                                        ) : match.status === 'in_progress' ? (
                                            <Link href={`/dashboard/matches/${match.id}/play`}>
                                                <button className="btn" style={{
                                                    padding: "0.25rem 0.75rem",
                                                    fontSize: "0.8rem",
                                                    background: "transparent",
                                                    border: "1px solid var(--primary)",
                                                    color: "var(--primary)"
                                                }}>
                                                    Continue
                                                </button>
                                            </Link>
                                        ) : (
                                            <span style={{
                                                fontSize: "0.9rem",
                                                padding: "0.25rem 0.75rem",
                                                background: "var(--surface-hover)",
                                                borderRadius: "1rem"
                                            }}>
                                                {match.status.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="card" style={{ padding: "3rem", textAlign: "center", color: "#888" }}>
                        No matches found for this session.
                    </div>
                )}
            </div>
        </main>
    );
}
