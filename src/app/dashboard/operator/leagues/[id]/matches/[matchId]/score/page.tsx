import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { createAdminClient } from "@/utils/supabase/admin";
import { calculateRace } from "@/utils/fargo";
import MatchScoringContainer from "@/components/MatchScoringContainer";

export default async function ScoreMatchPage({ params }: { params: Promise<{ id: string; matchId: string }> }) {
    const { id, matchId } = await params;
    const supabase = createAdminClient();

    // 1. Fetch Match Data
    const { data: match } = await supabase
        .from("matches")
        .select(`
      *,
      player1:player1_id(*),
      player2:player2_id(*)
    `)
        .eq("id", matchId)
        .single();

    if (!match) return <div>Match not found</div>;

    // 2. Fetch Games
    const { data: games } = await supabase
        .from("games")
        .select("*")
        .eq("match_id", matchId)
        .order("game_number", { ascending: true });

    // 3. Calculate Races
    const races = calculateRace(match.player1.fargo_rating, match.player2.fargo_rating);

    // 3.5 Fetch League & Profile for Permissions
    const { data: league } = await supabase.from("leagues").select("operator_id, status").eq("id", id).single();
    if (!league) return <div>League not found</div>;

    const { userId } = await auth();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();

    const isLeagueOperator = league?.operator_id === userId;
    const isAdmin = profile?.role === 'admin';
    const isOperator = isLeagueOperator || isAdmin;

    const isPlayer1 = userId === match.player1_id;
    const isPlayer2 = userId === match.player2_id;

    const p1Paid = ['paid_cash', 'paid_online', 'waived'].includes(match.payment_status_p1);
    const p2Paid = ['paid_cash', 'paid_online', 'waived'].includes(match.payment_status_p2);

    // If I am a player and I haven't paid, block me UNLESS I am the operator/admin
    if (isPlayer1 && !p1Paid && !isOperator) {
        return (
            <main>
                <Navbar />
                <div className="container" style={{ marginTop: "4rem", textAlign: "center", maxWidth: "600px" }}>
                    <div className="card" style={{ padding: "3rem", border: "1px solid var(--primary)" }}>
                        <h1 style={{ fontSize: "2rem", marginBottom: "1rem", color: "var(--primary)" }}>Match Fee Required</h1>
                        <p style={{ color: "#888", fontSize: "1.1rem", marginBottom: "2rem" }}>
                            A match fee of <strong>$20.00</strong> is required to start scoring.
                        </p>
                        <button className="btn btn-primary" style={{ width: "100%", padding: "1rem", fontSize: "1.1rem" }}>
                            Pay $20.00 with Polar
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    if (isPlayer2 && !p2Paid && !isOperator) {
        return (
            <main>
                <Navbar />
                <div className="container" style={{ marginTop: "4rem", textAlign: "center", maxWidth: "600px" }}>
                    <div className="card" style={{ padding: "3rem", border: "1px solid var(--primary)" }}>
                        <h1 style={{ fontSize: "2rem", marginBottom: "1rem", color: "var(--primary)" }}>Match Fee Required</h1>
                        <p style={{ color: "#888", fontSize: "1.1rem", marginBottom: "2rem" }}>
                            A match fee of <strong>$20.00</strong> is required to start scoring.
                        </p>
                        <button className="btn btn-primary" style={{ width: "100%", padding: "1rem", fontSize: "1.1rem" }}>
                            Pay $20.00 with Polar
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem" }}>
                {league.status === 'setup' && (
                    <div className="card" style={{ marginBottom: "2rem", border: "1px solid var(--warning)", textAlign: "center", color: "var(--warning)" }}>
                        <h3>Season Not Started</h3>
                        <p>Matches cannot be scored until the season is started.</p>
                    </div>
                )}

                {isOperator && (!p1Paid || !p2Paid) && (
                    <div className="card" style={{ marginBottom: "2rem", border: "1px solid var(--warning)" }}>
                        <h3 style={{ color: "var(--warning)", marginBottom: "1rem" }}>Payment Overrides</h3>
                        <div style={{ display: "flex", gap: "2rem" }}>
                            {!p1Paid && (
                                <div>
                                    <p style={{ marginBottom: "0.5rem" }}>{match.player1.full_name} (Unpaid)</p>
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <form action={async () => {
                                            'use server';
                                            const { markMatchPaid } = await import("@/app/actions/league-actions");
                                            await markMatchPaid(matchId, match.player1_id, 'cash');
                                        }}>
                                            <button className="btn" style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", background: "var(--success)", color: "#000" }}>Mark Paid (Cash)</button>
                                        </form>
                                        <form action={async () => {
                                            'use server';
                                            const { markMatchPaid } = await import("@/app/actions/league-actions");
                                            await markMatchPaid(matchId, match.player1_id, 'waived');
                                        }}>
                                            <button className="btn" style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", background: "var(--surface-hover)" }}>Waive</button>
                                        </form>
                                    </div>
                                </div>
                            )}
                            {!p2Paid && (
                                <div>
                                    <p style={{ marginBottom: "0.5rem" }}>{match.player2.full_name} (Unpaid)</p>
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <form action={async () => {
                                            'use server';
                                            const { markMatchPaid } = await import("@/app/actions/league-actions");
                                            await markMatchPaid(matchId, match.player2_id, 'cash');
                                        }}>
                                            <button className="btn" style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", background: "var(--success)", color: "#000" }}>Mark Paid (Cash)</button>
                                        </form>
                                        <form action={async () => {
                                            'use server';
                                            const { markMatchPaid } = await import("@/app/actions/league-actions");
                                            await markMatchPaid(matchId, match.player2_id, 'waived');
                                        }}>
                                            <button className="btn" style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", background: "var(--surface-hover)" }}>Waive</button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <MatchScoringContainer
                    match={match}
                    games={games || []}
                    races={races}
                    leagueId={id}
                    readOnly={match.status === 'finalized' || league.status === 'completed' || league.status === 'setup'}
                />
            </div>
        </main>
    );
}
