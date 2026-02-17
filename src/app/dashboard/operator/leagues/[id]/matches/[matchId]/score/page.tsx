import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { createAdminClient } from "@/utils/supabase/admin";
import { calculateRace } from "@/utils/bbrs";
import MatchScoringContainer from "@/components/MatchScoringContainer";
import Link from "next/link";

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

    if (!match) return <div className="p-8 text-white">Match not found</div>;

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
    if (!league) return <div className="p-8 text-white">League not found</div>;

    const { userId } = await auth();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();

    const isLeagueOperator = league?.operator_id === userId;
    const isAdmin = profile?.role === 'admin';
    const isOperator = isLeagueOperator || isAdmin;

    const isPlayer1 = userId === match.player1_id;
    const isPlayer2 = userId === match.player2_id;

    const p1Paid = ['paid_cash', 'paid_online', 'waived'].includes(match.payment_status_p1);
    const p2Paid = ['paid_cash', 'paid_online', 'waived'].includes(match.payment_status_p2);

    // Strict Payment Block
    if ((isPlayer1 && !p1Paid && !isOperator) || (isPlayer2 && !p2Paid && !isOperator)) {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <Navbar />
                <div className="card-glass max-w-md w-full p-8 text-center border-primary/50">
                    <h1 className="text-2xl font-bold text-primary mb-4 font-sans">Match Fee Required</h1>
                    <p className="text-gray-400 text-lg mb-8">
                        A match fee of <strong className="text-white">$20.00</strong> is required to start scoring.
                    </p>
                    <button className="btn btn-primary w-full py-3 text-lg font-bold">
                        Pay $20.00 with Stripe
                    </button>
                    <div className="mt-4 text-sm text-gray-500">
                        Please pay to unlock the scorecard.
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <div className="container py-8 max-w-4xl">
                <Link href={`/dashboard/operator/leagues/${id}`} className="text-sm text-gray-500 hover:text-white transition-colors mb-4 block">
                    &larr; Back to Session
                </Link>

                {league.status === 'setup' && (
                    <div className="bg-warning/10 border border-warning text-warning p-4 rounded mb-6 text-center font-bold">
                        Season Not Started - Matches cannot be scored yet.
                    </div>
                )}

                {isOperator && (!p1Paid || !p2Paid) && (
                    <div className="card-glass p-6 mb-6 border-warning/50">
                        <h3 className="text-lg font-bold text-warning mb-4">Payment Overrides</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {!p1Paid && (
                                <div className="bg-surface/50 p-4 rounded border border-border">
                                    <p className="font-bold text-white mb-2">{match.player1.full_name} <span className="text-error text-xs uppercase">(Unpaid)</span></p>
                                    <div className="flex gap-2">
                                        <form action={async () => {
                                            'use server';
                                            const { markMatchPaid } = await import("@/app/actions/league-actions");
                                            await markMatchPaid(matchId, match.player1_id, 'cash');
                                        }} className="flex-1">
                                            <button className="btn bg-success text-black text-xs w-full py-1 hover:bg-success/90 font-bold">Mark Paid (Cash)</button>
                                        </form>
                                        <form action={async () => {
                                            'use server';
                                            const { markMatchPaid } = await import("@/app/actions/league-actions");
                                            await markMatchPaid(matchId, match.player1_id, 'waived');
                                        }} className="flex-1">
                                            <button className="btn bg-surface border border-border text-gray-400 text-xs w-full py-1 hover:text-white">Waive</button>
                                        </form>
                                    </div>
                                </div>
                            )}
                            {!p2Paid && (
                                <div className="bg-surface/50 p-4 rounded border border-border">
                                    <p className="font-bold text-white mb-2">{match.player2.full_name} <span className="text-error text-xs uppercase">(Unpaid)</span></p>
                                    <div className="flex gap-2">
                                        <form action={async () => {
                                            'use server';
                                            const { markMatchPaid } = await import("@/app/actions/league-actions");
                                            await markMatchPaid(matchId, match.player2_id, 'cash');
                                        }} className="flex-1">
                                            <button className="btn bg-success text-black text-xs w-full py-1 hover:bg-success/90 font-bold">Mark Paid (Cash)</button>
                                        </form>
                                        <form action={async () => {
                                            'use server';
                                            const { markMatchPaid } = await import("@/app/actions/league-actions");
                                            await markMatchPaid(matchId, match.player2_id, 'waived');
                                        }} className="flex-1">
                                            <button className="btn bg-surface border border-border text-gray-400 text-xs w-full py-1 hover:text-white">Waive</button>
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
