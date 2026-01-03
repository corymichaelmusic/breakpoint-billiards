import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { getLeagueStats, getSessionStats, PlayerStats } from "@/app/actions/stats-actions";

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    const { data: league } = await supabase
        .from("leagues")
        .select("id, name, type")
        .eq("id", id)
        .single();

    if (!league) return <div className="text-white p-8">League not found</div>;

    let stats: PlayerStats[] = [];
    let title = "";

    if (league.type === 'league') {
        title = "All Time Stats";
        stats = await getLeagueStats(id);
    } else {
        title = "Session Stats";
        stats = await getSessionStats(id);
    }

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <div className="container py-8 max-w-5xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Link href={`/dashboard/operator/leagues/${id}`} className="text-sm text-gray-500 hover:text-white transition-colors">&larr; Back to Dashboard</Link>
                        <h1 className="text-3xl font-bold font-sans text-primary mt-2">{league.name}</h1>
                        <p className="text-gray-400">{title}</p>
                    </div>
                </div>

                <div className="card-glass p-6">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border text-gray-500 text-xs uppercase">
                                    <th className="p-3 text-center">Rank</th>
                                    <th className="p-3">Player</th>
                                    <th className="p-3 text-right">Win Rate</th>
                                    <th className="p-3 text-center">W - L</th>
                                    <th className="p-3 text-center">Played</th>
                                    <th className="p-3 text-center">Points</th>
                                    <th className="p-3 text-center">PPM</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {stats.map((stat) => (
                                    <tr key={stat.playerId} className="hover:bg-white/5 transition-colors text-sm">
                                        <td className="p-3 text-center font-bold text-primary">#{stat.rank}</td>
                                        <td className="p-3 font-medium text-white">
                                            <Link href={`/dashboard/operator/leagues/${id}/players/${stat.playerId}`} className="hover:text-primary transition-colors">
                                                {stat.playerName}
                                            </Link>
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold">{stat.winRate}%</td>
                                        <td className="p-3 text-center text-gray-400">{stat.matchesWon} - {stat.matchesLost}</td>
                                        <td className="p-3 text-center text-gray-400">{stat.matchesPlayed}</td>
                                        <td className="p-3 text-center font-bold text-white">{stat.totalPoints}</td>
                                        <td className="p-3 text-center text-gray-400">{stat.pointsPerMatch}</td>
                                    </tr>
                                ))}
                                {stats.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500 italic">
                                            No stats available yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
}
