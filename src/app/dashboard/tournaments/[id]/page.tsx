
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import TournamentManagerClient from "./TournamentManagerClient";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function TournamentManagerPage({ params }: PageProps) {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    // 1. Fetch Tournament Details
    const { data: tournament } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", id)
        .single();

    if (!tournament) return <div>Tournament not found</div>;

    // 2. Fetch Matches
    // Updated Query: Joins tournament_matches -> tournament_participants -> profiles (aliased as player)
    const { data: matches } = await supabase
        .from("tournament_matches")
        .select(`
            id,
            match_position_code,
            round_label,
            status,
            table_assigned,
            score1,
            score2,
            player1:player1_id(guest_name, player:player_id(full_name)),
            player2:player2_id(guest_name, player:player_id(full_name))
        `)
        .eq("tournament_id", id)
        .order("created_at", { ascending: true });

    // 3. Fetch Participants (for standings/list)
    const { data: participants } = await supabase
        .from("tournament_participants")
        .select(`
            seed,
            player:player_id(full_name, fargo_rating, id)
        `)
        .eq("tournament_id", id)
        .order("seed", { ascending: true });

    const tableConfig = tournament.table_config || [];

    return (
        <main className="min-h-screen flex flex-col bg-background">
            <Navbar />

            {/* Header Section (Centered with absolute/grid positioning) */}
            <div className="w-full px-6 pt-8 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 items-center">

                    {/* Left: Back Button */}
                    <div className="flex justify-start mb-4 md:mb-0">
                        <Link
                            href="/dashboard/tournaments"
                            className="font-bold flex items-center gap-2 transition-colors uppercase text-sm tracking-wide hover:brightness-110"
                            style={{ color: '#D4AF37' }}
                        >
                            <span className="text-lg">←</span> Back to Tournaments
                        </Link>
                    </div>

                    {/* Center: Title & Metadata */}
                    <div className="flex flex-col items-center justify-center text-center">
                        <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight whitespace-nowrap">
                            {tournament.name}
                        </h1>
                        <div className="flex gap-2 mt-3 justify-center">
                            <span className="capitalize px-3 py-1 rounded-full bg-surface border border-border text-xs font-bold text-gray-300">
                                {tournament.game_type === '8ball' ? '🎱 8-Ball' : '🎱 9-Ball'}
                            </span>
                            <span className="capitalize px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
                                {tournament.status}
                            </span>
                        </div>
                    </div>

                    {/* Right: Spacer (for balance) */}
                    <div className="hidden md:block"></div>
                </div>
            </div>

            {/* Full Screen Interactive Area (Full Width) */}
            <div className="flex-1 w-full relative border-t border-white/10">
                <TournamentManagerClient
                    initialMatches={matches || []}
                    initialParticipants={participants || []}
                    tournamentId={id}
                    tableConfig={tableConfig}
                />
            </div>
        </main>
    );
}
