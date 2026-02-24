import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getPlayerLeagueStats, getPlayerLifetimeStats } from "@/app/actions/stats-actions";
import BackButton from "@/components/BackButton";
import { PlayerStats } from "@/utils/stats-calculator";

import { verifyOperator } from "@/utils/auth-helpers";

export default async function OperatorPlayerSessionPage({ params }: { params: Promise<{ id: string, playerId: string }> }) {
    const { id: sessionId, playerId } = await params;
    const { userId } = await verifyOperator(sessionId);

    const supabase = await createClient();

    // Fetch Data in Initial Load
    // Use getPlayerLeagueStats to handle Parent League aggregation if 'sessionId' is actually a League ID
    const [stats, lifetimeStats, playerResponse, sessionResponse] = await Promise.all([
        getPlayerLeagueStats(playerId, sessionId),
        getPlayerLifetimeStats(playerId),
        supabase.from("profiles").select("*").eq("id", playerId).single(),
        supabase.from("leagues").select("name").eq("id", sessionId).single()
    ]);

    const player = playerResponse.data;
    const session = sessionResponse.data;
    const currentRating = player?.breakpoint_rating || 500;

    // Calculate Global Rank (Consistent with Leaderboard)
    const { data: topPlayers } = await supabase
        .from('profiles')
        .select('id')
        .order('breakpoint_rating', { ascending: false })
        .limit(50);

    let rank = 0;
    const topIndex = topPlayers?.findIndex(p => p.id === playerId);

    if (topIndex !== undefined && topIndex !== -1) {
        rank = topIndex + 1;
    } else {
        // Fallback for outside top 50
        const { count: higherRankedCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gt('breakpoint_rating', currentRating);
        rank = (higherRankedCount || 0) + 1;
    }

    // Fallback if stats are empty/null
    if (!stats || !lifetimeStats) return <div>Loading...</div>;

    return (
        <main className="min-h-screen bg-background pb-12">
            <Navbar />
            <div className="container mt-8 max-w-5xl">
                <div className="h-[10px]" />
                <BackButton label="Back" className="!text-[#D4AF37] hover:!text-white" />

                <div className="mb-8 mt-2">
                    <h1 className="text-3xl font-bold font-sans text-white">
                        {player?.full_name || "Player"}
                    </h1>
                    <p className="text-gray-300 text-lg">{session?.name} Stats</p>
                </div>

                {/* Lifetime Stats */}
                <div className="card-glass border border-border rounded-xl p-6 mb-8">
                    <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                        <h2 className="text-white text-xl font-bold max-w-[70%]">
                            Lifetime Stats
                        </h2>
                        <div className="text-[#D4AF37] font-bold text-lg">
                            Rank: {rank || '-'}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-y-8 gap-x-4 justify-between pt-2">
                        <StatBox label="Win %" value={`${lifetimeStats.winRate}%`} />
                        <StatBox label="W-L" value={`${lifetimeStats.matchesWon}-${lifetimeStats.matchesPlayed - lifetimeStats.matchesWon}`} />
                        <StatBox label="Sets Played" value={lifetimeStats.matchesPlayed} />
                        <StatBox label="Confidence" value={lifetimeStats.totalRacksPlayed} />
                        <StatBox label="BP Level" value={lifetimeStats.breakPoint || 1} highlight />
                        <StatBox label="Shutouts" value={lifetimeStats.display_shutouts} />
                    </div>
                </div>

                {/* 8-Ball and 9-Ball Detailed Sets Grid */}
                <div className="grid md:grid-cols-2 gap-8 mb-4">
                    {/* 8-Ball Sets */}
                    <div className="card-glass p-6 border-t-4 border-t-purple-500 rounded-xl">
                        <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
                            <h3 className="text-white text-lg font-bold shrink">8-Ball Sets</h3>
                            <div className="flex items-center gap-1 shrink">
                                <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
                                    {stats.racksPlayed_8ball} Racks: {stats.racksWon_8ball}-{stats.racksPlayed_8ball - stats.racksWon_8ball}
                                </span>
                                <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
                                    ({stats.display_gameWinRate8})
                                </span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <StatRow label="Win %" value={stats.display_setWinRate8} />
                            <StatRow label="W-L" value={stats.display_setRecord8} />
                            <StatRow label="Break & Runs" value={stats.breakAndRuns_8ball} />
                            <StatRow label="Rack & Runs" value={stats.rackAndRuns_8ball} />
                        </div>
                    </div>

                    {/* 9-Ball Sets */}
                    <div className="card-glass p-6 border-t-4 border-t-yellow-500 rounded-xl">
                        <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
                            <h3 className="text-white text-lg font-bold shrink">9-Ball Sets</h3>
                            <div className="flex items-center gap-1 shrink">
                                <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
                                    {stats.racksPlayed_9ball} Racks: {stats.racksWon_9ball}-{stats.racksPlayed_9ball - stats.racksWon_9ball}
                                </span>
                                <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
                                    ({stats.display_gameWinRate9})
                                </span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <StatRow label="Win %" value={stats.display_setWinRate9} />
                            <StatRow label="W-L" value={stats.display_setRecord9} />
                            <StatRow label="Break & Runs" value={stats.breakAndRuns_9ball} />
                            <StatRow label="9 on the Snap" value={stats.nineOnSnaps_9ball} />
                        </div>
                    </div>
                </div>

            </div>
        </main>
    );
}

function StatBox({ label, value, highlight }: { label: string, value: string | number, highlight?: boolean }) {
    return (
        <div className="flex flex-col items-center justify-center text-center">
            <div className={`text-2xl font-bold ${highlight ? 'text-[#D4AF37]' : 'text-white'}`}>
                {value}
            </div>
            <div className="text-gray-400 text-xs uppercase tracking-wider mt-1 font-semibold">
                {label}
            </div>
        </div>
    );
}

function StatRow({ label, value }: { label: string, value: string | number }) {
    return (
        <div className="flex justify-between items-center py-3 border-b border-gray-800/50 last:border-0">
            <span className="text-gray-300 font-medium text-sm">{label}</span>
            <span className="text-[#D4AF37] font-bold text-lg">{value}</span>
        </div>
    );
}
