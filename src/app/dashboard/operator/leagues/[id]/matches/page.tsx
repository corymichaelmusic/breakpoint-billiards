import { createAdminClient } from "@/utils/supabase/admin";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import MatchesView from "@/components/MatchesView";
import { verifyOperator } from "@/utils/auth-helpers";

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
    const { data: matches } = await supabase
        .from("matches")
        .select(`
      *,
      player1:player1_id(full_name),
      player2:player2_id(full_name)
    `)
        .eq("league_id", id)
        .order("week_number", { ascending: true })
        .order("created_at", { ascending: true });

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

    return (
        <main className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <div className="container py-8 max-w-6xl">
                <div className="mb-6">
                    <Link href={`/dashboard/operator/leagues/${id}`} className="text-sm text-[#D4AF37] hover:text-white transition-colors">&larr; Back to Dashboard</Link>
                    <h1 className="text-3xl font-bold font-sans text-white mt-2">
                        Matches <span className="text-gray-500 text-lg font-normal">/ {league.name}</span>
                    </h1>
                </div>

                <MatchesView
                    matches={matches || []}
                    leagueId={id}
                    leagueStatus={league.status}
                    timezone={league.timezone}
                    playerRatings={playerRatings}
                />
            </div>
        </main>
    );
}
