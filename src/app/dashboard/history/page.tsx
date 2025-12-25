import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { getPlayerLifetimeStats } from "@/app/actions/stats-actions";

export default async function HistoryPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect("/sign-in");
    }

    const supabase = await createClient();
    const lifetimeStats = await getPlayerLifetimeStats(userId);

    // Fetch ALL matches for the user
    const { data: matches } = await supabase
        .from("matches")
        .select(`
            *,
            player1:player1_id(full_name),
            player2:player2_id(full_name),
            leagues(name)
        `)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq("status", "finalized")
        .not("submitted_at", "is", null)
        .order('scheduled_date', { ascending: false });

    return (
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem", paddingBottom: "4rem", maxWidth: "800px" }}>
                <Link href="/dashboard" style={{ fontSize: "0.9rem", opacity: 0.7, display: 'block', marginBottom: '1rem' }}>
                    &larr; Back to Dashboard
                </Link>

                <div style={{ marginBottom: "2rem" }}>
                    <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--primary)" }}>
                        Lifetime Stats & Match History
                    </h1>
                    <p style={{ color: "#888" }}>Comprehensive statistics and match history.</p>
                </div>

                {/* Detailed Stats Grid */}
                <div className="card" style={{ padding: "2rem", marginBottom: "3rem" }}>
                    <h2 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                        Detailed Statistics
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
                        <div>
                            <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: "0.25rem" }}>Win Rate</p>
                            <p style={{ fontSize: "2rem", fontWeight: "bold", margin: 0, color: "var(--primary)" }}>{lifetimeStats?.winRate || 0}%</p>
                        </div>
                        <div>
                            <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: "0.25rem" }}>Points / Match</p>
                            <p style={{ fontSize: "2rem", fontWeight: "bold", margin: 0 }}>{lifetimeStats?.pointsPerMatch || 0}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: "0.25rem" }}>Matches</p>
                            <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>
                                <span style={{ color: "var(--success)" }}>W {lifetimeStats?.matchesWon}</span> - <span style={{ color: "var(--error)" }}>L {lifetimeStats?.matchesLost}</span>
                            </p>
                        </div>
                        <div>
                            <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: "0.25rem" }}>Total Points</p>
                            <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>{lifetimeStats?.totalPoints}</p>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
                        {/* 8-Ball Stats */}
                        <div>
                            <h3 style={{ fontSize: "1rem", color: "var(--foreground)", marginBottom: "1rem", borderBottom: "1px solid var(--primary)", display: "inline-block", paddingBottom: "0.25rem" }}>8-Ball</h3>
                            <div style={{ marginBottom: "1rem" }}>
                                <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: "0.25rem" }}>Win Rate</p>
                                <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0, color: "var(--primary)" }}>{lifetimeStats?.winRate_8ball || 0}%</p>
                            </div>
                            <div>
                                <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: "0.25rem" }}>Record</p>
                                <p style={{ fontSize: "1.25rem", fontWeight: "bold", margin: 0 }}>
                                    <span style={{ color: "var(--success)" }}>W {lifetimeStats?.matchesWon_8ball}</span> - <span style={{ color: "#fff" }}>L {lifetimeStats?.matchesLost_8ball}</span>
                                </p>
                            </div>
                        </div>

                        {/* 9-Ball Stats */}
                        <div>
                            <h3 style={{ fontSize: "1rem", color: "var(--foreground)", marginBottom: "1rem", borderBottom: "1px solid var(--primary)", display: "inline-block", paddingBottom: "0.25rem" }}>9-Ball</h3>
                            <div style={{ marginBottom: "1rem" }}>
                                <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: "0.25rem" }}>Win Rate</p>
                                <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0, color: "var(--primary)" }}>{lifetimeStats?.winRate_9ball || 0}%</p>
                            </div>
                            <div>
                                <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: "0.25rem" }}>Record</p>
                                <p style={{ fontSize: "1.25rem", fontWeight: "bold", margin: 0 }}>
                                    <span style={{ color: "var(--success)" }}>W {lifetimeStats?.matchesWon_9ball}</span> - <span style={{ color: "#fff" }}>L {lifetimeStats?.matchesLost_9ball}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#888" }}>Achievements</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "1rem", textAlign: "center" }}>
                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px" }}>
                            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem" }}>8B B&R</p>
                            <p style={{ fontSize: "1.2rem", fontWeight: "bold", margin: 0 }}>{lifetimeStats?.breakAndRuns_8ball || 0}</p>
                        </div>
                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px" }}>
                            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem" }}>8B R&R</p>
                            <p style={{ fontSize: "1.2rem", fontWeight: "bold", margin: 0 }}>{lifetimeStats?.rackAndRuns_8ball || 0}</p>
                        </div>
                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px" }}>
                            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem" }}>9B B&R</p>
                            <p style={{ fontSize: "1.2rem", fontWeight: "bold", margin: 0 }}>{lifetimeStats?.breakAndRuns_9ball || 0}</p>
                        </div>
                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px" }}>
                            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem" }}>9B R&R</p>
                            <p style={{ fontSize: "1.2rem", fontWeight: "bold", margin: 0 }}>{lifetimeStats?.rackAndRuns_9ball || 0}</p>
                        </div>
                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px" }}>
                            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem" }}>9B Zip</p>
                            <p style={{ fontSize: "1.2rem", fontWeight: "bold", margin: 0 }}>{lifetimeStats?.winZips_9ball || 0}</p>
                        </div>
                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px" }}>
                            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem" }}>9B Snap</p>
                            <p style={{ fontSize: "1.2rem", fontWeight: "bold", margin: 0 }}>{lifetimeStats?.nineOnSnaps_9ball || 0}</p>
                        </div>
                    </div>
                </div>

                {matches && matches.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {matches.map((match) => {
                            const isWinner = match.winner_id === userId;
                            const opponent = match.player1_id === userId ? match.player2 : match.player1;
                            const isFinalized = match.status === 'finalized';
                            // @ts-ignore - leagues is joined
                            const leagueName = match.leagues?.name || 'Unknown League';

                            return (
                                <Link href={`/dashboard/matches/${match.id}/play`} key={match.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div className="card hover-effect" style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "1.5rem",
                                        borderLeft: isFinalized ? (isWinner ? "4px solid var(--success)" : "4px solid var(--error)") : "4px solid var(--border)",
                                        cursor: "pointer",
                                        transition: "transform 0.2s"
                                    }}>
                                        <div>
                                            <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                                {leagueName} • Week {match.week_number} • {new Date(match.created_at).toLocaleDateString()}
                                            </div>
                                            <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                                                vs {opponent?.full_name || 'Unknown'}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            {isFinalized ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-end" }}>
                                                    {/* 8-Ball Result */}
                                                    {match.status_8ball === 'finalized' && (
                                                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                                            <span style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>8-Ball</span>
                                                            <span style={{
                                                                fontSize: "1rem",
                                                                fontWeight: "bold",
                                                                color: match.winner_id_8ball === userId ? "var(--success)" : "var(--error)"
                                                            }}>
                                                                {match.winner_id_8ball === userId ? "WIN" : "LOSS"}
                                                            </span>
                                                            <span style={{ fontSize: "0.9rem", color: "#888", minWidth: "30px", textAlign: "right" }}>
                                                                {match.points_8ball_p1 || 0}-{match.points_8ball_p2 || 0}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {/* 9-Ball Result */}
                                                    {match.status_9ball === 'finalized' && (
                                                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                                            <span style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>9-Ball</span>
                                                            <span style={{
                                                                fontSize: "1rem",
                                                                fontWeight: "bold",
                                                                color: match.winner_id_9ball === userId ? "var(--success)" : "var(--error)"
                                                            }}>
                                                                {match.winner_id_9ball === userId ? "WIN" : "LOSS"}
                                                            </span>
                                                            <span style={{ fontSize: "0.9rem", color: "#888", minWidth: "30px", textAlign: "right" }}>
                                                                {match.points_9ball_p1 || 0}-{match.points_9ball_p2 || 0}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {/* Fallback if somehow finalized but neither specific status set? Should not happen if schema valid. 
                                                        But if legacy data, show total? */}
                                                    {(!match.status_8ball && !match.status_9ball) && (
                                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                                            <span style={{
                                                                fontSize: "1.25rem",
                                                                fontWeight: "bold",
                                                                color: isWinner ? "var(--success)" : "var(--error)"
                                                            }}>
                                                                {isWinner ? "WIN" : "LOSS"}
                                                            </span>
                                                            <span style={{ fontSize: "0.9rem", color: "#666" }}>
                                                                {match.current_points_p1}-{match.current_points_p2}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
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
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="card" style={{ padding: "3rem", textAlign: "center", color: "#888" }}>
                        No match history found.
                    </div>
                )}
            </div>
        </main>
    );
}
