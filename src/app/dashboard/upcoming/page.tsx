import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import RequestUnlockButton from "@/components/RequestUnlockButton";

export default async function UpcomingMatchesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
    const { userId } = await auth();
    const { view } = await searchParams;

    if (!userId) {
        redirect("/sign-in");
    }

    const supabase = await createClient();

    // Fetch ALL scheduled matches for the user
    const { data: matches } = await supabase
        .from("matches")
        .select(`
            *,
            is_manually_unlocked,
            player1:player1_id(full_name),
            player2:player2_id(full_name),
            league:league_id!inner(name, status, timezone, parent_league:parent_league_id(name)),
            reschedule_requests(status)
        `)
        .eq("league.status", "active")
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq("status", "scheduled")
        .order('scheduled_date', { ascending: true });

    return (
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem", paddingBottom: "4rem", maxWidth: "800px" }}>
                <Link href={`/dashboard${view === 'player' ? '?view=player' : ''}`} style={{ fontSize: "0.9rem", opacity: 0.7, display: 'block', marginBottom: '1rem' }}>
                    &larr; Back to Dashboard
                </Link>

                <div style={{ marginBottom: "2rem" }}>
                    <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--primary)" }}>
                        Upcoming Matches
                    </h1>
                    <p style={{ color: "#888" }}>All your scheduled matches across all sessions.</p>
                </div>

                {matches && matches.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {matches.map((match) => {
                            const opponent = match.player1_id === userId ? match.player2 : match.player1;
                            // @ts-ignore
                            const leagueName = match.league?.name || 'Unknown Session';
                            // @ts-ignore
                            const parentName = match.league?.parent_league?.name;

                            return (
                                <div key={match.id} className="card" style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "1.5rem",
                                    borderLeft: "4px solid var(--primary)"
                                }}>
                                    <div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            {parentName}
                                        </div>
                                        <div style={{ fontSize: "0.9rem", color: "#fff", marginBottom: "0.25rem", fontWeight: "bold" }}>
                                            {leagueName}
                                        </div>
                                        <div style={{ fontSize: "0.9rem", color: "#888", marginBottom: "0.25rem" }}>
                                            Week {match.week_number} • {match.scheduled_date ? new Date(match.scheduled_date).toLocaleDateString() : 'TBD'}
                                        </div>
                                        <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                                            vs {opponent?.full_name || 'Unknown'}
                                        </div>
                                    </div>
                                    <div>
                                        {(() => {
                                            // @ts-ignore
                                            const timezone = match.league?.timezone || 'America/Chicago';

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
                                            let startWindow, endWindow;

                                            // Fallback default: unlocked if invalid date or allow if strictly valid
                                            // If invalid date, we assume unlocked for now? Or locked?
                                            // Let's wrap in check
                                            if (!isNaN(scheduledDate.getTime())) {
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
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Link href={`/dashboard/matches/${match.id}/play`}>
                                                            <button className="btn btn-primary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}>
                                                                Play
                                                            </button>
                                                        </Link>
                                                    </div>
                                                );
                                            }
                                        })()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="card" style={{ padding: "3rem", textAlign: "center", color: "#888" }}>
                        No upcoming matches scheduled.
                    </div>
                )}
            </div>
        </main >
    );
}
