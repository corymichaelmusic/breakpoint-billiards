import { createAdminClient } from "@/utils/supabase/admin";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import MatchesView from "@/components/MatchesView";
import { verifyOperator } from "@/utils/auth-helpers";
import { calculateRace } from "@/utils/bbrs";

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    await verifyOperator(id);

    const supabase = createAdminClient();

    // Fetch league details
    const { data: league } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", id)
        .single();

    if (!league) {
        return <div className="text-white p-8">League not found</div>;
    }

    // Fetch matches
    const { data: matches, error } = await supabase
        .from("matches")
        .select(`
      *,
      player1:player1_id(full_name),
      player2:player2_id(full_name),
      games(winner_id, is_break_and_run, is_9_on_snap, game_type, game_number)
    `)
        .eq("league_id", id)
        .order("week_number", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });



    // Fetch League Players to get the roster
    const { data: lpData } = await supabase
        .from("league_players")
        .select("player_id, breakpoint_racks_played")
        .eq("league_id", id);

    const playerIds = lpData?.map(p => p.player_id) || [];

    // Fetch Global Ratings from Profiles
    const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, breakpoint_rating, full_name")
        .in("id", playerIds);

    const playerRatings: Record<string, { rating: number, confidence: number }> = {};

    if (profilesData) {
        profilesData.forEach(p => {
            // Find matching league_player for confidence/racks (using local racks for now)
            const lp = lpData?.find(l => l.player_id === p.id);
            const racks = lp?.breakpoint_racks_played || 0;

            playerRatings[p.id] = {
                rating: p.breakpoint_rating ?? 500, // Global Rating
                confidence: racks // Use Racks Played as confidence
            };
        });
    }

    const matchesWithDisplayRaces = (matches || []).map((match) => {
        const hasStoredRaces = (
            match.race_8ball_p1 != null &&
            match.race_8ball_p2 != null &&
            match.race_9ball_p1 != null &&
            match.race_9ball_p2 != null
        );
        const isMatchStartedOrFinalized = (
            match.status !== 'scheduled' ||
            match.status_8ball === 'in_progress' ||
            match.status_8ball === 'finalized' ||
            match.status_9ball === 'in_progress' ||
            match.status_9ball === 'finalized' ||
            match.started_at != null ||
            match.started_at_8ball != null ||
            match.started_at_9ball != null
        );
        const p1CurrentRating = playerRatings[match.player1_id]?.rating ?? 500;
        const p2CurrentRating = playerRatings[match.player2_id]?.rating ?? 500;
        const previewRaces = calculateRace(p1CurrentRating, p2CurrentRating);
        const shouldUseStoredRaces = hasStoredRaces && isMatchStartedOrFinalized;

        return {
            ...match,
            display_race_8ball_p1: shouldUseStoredRaces ? match.race_8ball_p1 : previewRaces.race8.p1,
            display_race_8ball_p2: shouldUseStoredRaces ? match.race_8ball_p2 : previewRaces.race8.p2,
            display_race_9ball_p1: shouldUseStoredRaces ? match.race_9ball_p1 : previewRaces.race9.p1,
            display_race_9ball_p2: shouldUseStoredRaces ? match.race_9ball_p2 : previewRaces.race9.p2,
        };
    });

    return (
        <main className="console-page flex flex-col">
            <Navbar />
            <div className="console-container">
                <div className="console-header">
                    <div>
                    <Link href={`/dashboard/operator/leagues/${id}`} className="text-sm text-[#D4AF37] hover:text-white transition-colors">&larr; Back to Dashboard</Link>
                    <h1 className="console-title mt-2">
                        Matches <span className="text-gray-500 text-lg font-normal">/ {league.name}</span>
                    </h1>
                    </div>
                </div>

                <MatchesView
                    matches={matchesWithDisplayRaces}
                    leagueId={id}
                    leagueStatus={league.status}
                    timezone={league.timezone}
                    playerRatings={playerRatings}
                />
            </div>
        </main>
    );
}
