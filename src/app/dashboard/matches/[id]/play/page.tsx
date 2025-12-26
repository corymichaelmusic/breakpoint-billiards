import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PlayMatchPage({ params }: { params: Promise<{ id: string }> }) {
    const { userId } = await auth();
    const { id: matchId } = await params;

    if (!userId) {
        redirect("/sign-in");
    }

    const supabase = await createClient();

    // Fetch match details
    const { data: match } = await supabase
        .from("matches")
        .select(`
            *,
            player1:player1_id(full_name, fargo_rating),
            player2:player2_id(full_name, fargo_rating),
            leagues(name)
        `)
        .eq("id", matchId)
        .single();

    console.log(`[PlayMatchPage] Fetched match ${matchId}:`, {
        status_8ball: match?.status_8ball,
        winner_id_8ball: match?.winner_id_8ball,
        status_9ball: match?.status_9ball,
        winner_id_9ball: match?.winner_id_9ball
    });

    if (!match) {
        return <div>Match not found</div>;
    }

    // Fetch Games
    const { data: games } = await supabase
        .from("games")
        .select("*")
        .eq("match_id", matchId)
        .order("game_number", { ascending: true });

    // Calculate Races
    const { calculateRace } = await import("@/utils/fargo");
    const races = calculateRace(match.player1.fargo_rating, match.player2.fargo_rating);

    // Fetch Breakpoint Ratings
    const { calculatePlayerRating } = await import("@/app/actions/stats-actions");
    const p1Rating = await calculatePlayerRating(match.player1_id);
    const p2Rating = await calculatePlayerRating(match.player2_id);

    // Check Match Lock
    const { checkMatchLock } = await import("@/app/actions/match-actions");
    const lockStatus = await checkMatchLock(matchId);

    // Import MatchScoringContainer
    const MatchScoringContainer = (await import("@/components/MatchScoringContainer")).default;

    return (
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem" }}>
                <MatchScoringContainer
                    match={match}
                    games={games || []}
                    races={races}
                    leagueId={match.league_id}
                    backLink={`/dashboard?sessionId=${match.league_id}&view=player`}
                    backText="Return to Dashboard"
                    p1BreakpointRating={parseFloat(p1Rating)}
                    p2BreakpointRating={parseFloat(p2Rating)}
                    isLocked={lockStatus.locked}
                    lockReason={lockStatus.reason}
                />
            </div>
        </main>
    );
}
