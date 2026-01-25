import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getPlayerLeagueStats, getPlayerLifetimeStats } from "@/app/actions/stats-actions";
import BackButton from "@/components/BackButton";
import { PlayerStats } from "@/utils/stats-calculator";

export default async function OperatorPlayerSessionPage({ params }: { params: Promise<{ id: string, playerId: string }> }) {
    const { id: sessionId, playerId } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    // Verify Operator Role
    const { data: currentUser } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (currentUser?.role !== 'operator' && currentUser?.role !== 'admin') {
        redirect("/dashboard");
    }

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

    // Use lifetime racks played as confidence score
    const confidenceScore = lifetimeStats?.totalRacksPlayed || 0;

    // Fallback if stats are empty/null
    if (!stats) return <div>Loading...</div>;

    return (
        <main className="min-h-screen bg-background pb-12">
            <Navbar />
            <div className="container mt-8 max-w-5xl">
                <div className="h-[10px]" />
                <BackButton label="Back" className="!text-[#D4AF37] hover:!text-white" />

                <div className="mb-20">
                    <h1 className="text-3xl font-bold font-sans text-white">
                        {player?.full_name}
                    </h1>
                    <p className="text-gray-300 text-lg">{session?.name} Stats</p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-16 mb-12">
                    <div className="card-glass p-6 text-center">
                        <div className="text-3xl font-bold text-[#D4AF37]">{stats.display_setWinRate}</div>
                        <div className="text-gray-400 text-sm uppercase tracking-wider mt-1">Set Win %</div>
                    </div>
                    <div className="card-glass p-6 text-center">
                        <div className="text-3xl font-bold text-white">{stats.display_setRecord}</div>
                        <div className="text-gray-400 text-sm uppercase tracking-wider mt-1">Set Record</div>
                    </div>
                    <div className="card-glass p-6 text-center">
                        <div className="text-3xl font-bold text-blue-400">{stats.display_gameWinRate}</div>
                        <div className="text-gray-400 text-sm uppercase tracking-wider mt-1">Game Win %</div>
                    </div>
                    <div className="card-glass p-6 text-center">
                        <div className="text-3xl font-bold text-white">{stats.display_gameRecord}</div>
                        <div className="text-gray-400 text-sm uppercase tracking-wider mt-1">Game Record</div>
                    </div>
                </div>

                {/* Explicit Spacer for Visual Separation */}
                <div style={{ height: "50px", width: "100%" }} />

                {/* Detailed Stats Grid */}
                <div className="grid md:grid-cols-2 gap-16 mb-4">
                    {/* 8-Ball Panel */}
                    <div className="card-glass p-6 border-t-4 border-t-purple-500">
                        <h3 className="text-xl font-bold text-purple-400 mb-6 border-b border-gray-700 pb-2">8-Ball Stats</h3>
                        <div className="space-y-4">
                            <StatRow label="Set Performance" value={`${stats.display_setWinRate8} (${stats.display_setRecord8})`} highlight />
                            <StatRow label="Game Performance" value={`${stats.display_gameWinRate8} (${stats.display_gameRecord8})`} />

                            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-800">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{stats.breakAndRuns_8ball}</div>
                                    <div className="text-xs text-gray-500 uppercase">Break & Runs</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{stats.rackAndRuns_8ball}</div>
                                    <div className="text-xs text-gray-500 uppercase">Rack & Runs</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 9-Ball Panel */}
                    <div className="card-glass p-6 border-t-4 border-t-yellow-500">
                        <h3 className="text-xl font-bold text-yellow-400 mb-6 border-b border-gray-700 pb-2">9-Ball Stats</h3>
                        <div className="space-y-4">
                            <StatRow label="Set Performance" value={`${stats.display_setWinRate9} (${stats.display_setRecord9})`} highlight />
                            <StatRow label="Game Performance" value={`${stats.display_gameWinRate9} (${stats.display_gameRecord9})`} />

                            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-800">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{stats.breakAndRuns_9ball}</div>
                                    <div className="text-xs text-gray-500 uppercase">Break & Runs</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{stats.nineOnSnaps_9ball}</div>
                                    <div className="text-xs text-gray-500 uppercase">9 on Snap</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Metrics */}
                <div className="mt-0">
                    <h3 className="text-lg font-bold text-white mb-4">Additional Metrics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                        <div className="card-glass p-6 text-center">
                            <div className="text-2xl font-bold text-yellow-500">{stats.display_shutouts}</div>
                            <div className="text-sm text-gray-400">Total Shutouts</div>
                        </div>
                        <div className="card-glass p-6 text-center">
                            <div className="text-2xl font-bold text-[#4ade80]">{confidenceScore}</div>
                            <div className="text-sm text-gray-400">Confidence Score</div>
                        </div>
                        <div className="card-glass p-6 text-center">
                            <div className="text-2xl font-bold text-white">{stats.breakPoint}</div>
                            <div className="text-sm text-gray-400">BreakPoint Level</div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

function StatRow({ label, value, highlight = false }: { label: string, value: string | number, highlight?: boolean }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm uppercase">{label}</span>
            <span className={`font-mono font-bold ${highlight ? 'text-white text-lg' : 'text-gray-300'}`}>
                {value}
            </span>
        </div>
    );
}
