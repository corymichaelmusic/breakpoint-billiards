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

    // Determine if this is a League or a Session
    const { data: league } = await supabase
        .from("leagues")
        .select("id, name, type")
        .eq("id", id)
        .single();

    if (!league) return <div>League not found</div>;

    let stats: PlayerStats[] = [];
    let title = "";

    if (league.type === 'league') {
        title = `${league.name} - All Time Stats`;
        stats = await getLeagueStats(id);
    } else {
        title = `${league.name} - Session Stats`;
        stats = await getSessionStats(id);
    }

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem" }}>
                <div style={{ marginBottom: "2rem" }}>
                    <Link href={`/dashboard/operator/leagues/${id}`} style={{ fontSize: "0.9rem", opacity: 0.7 }}>&larr; Back to Dashboard</Link>
                    <h1 style={{ marginTop: "0.5rem" }}>{title}</h1>
                </div>

                <div className="card">
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                                <th style={{ padding: "1rem" }}>Rank</th>
                                <th style={{ padding: "1rem" }}>Player</th>
                                <th style={{ padding: "1rem" }}>Win Rate</th>
                                <th style={{ padding: "1rem" }}>W - L</th>
                                <th style={{ padding: "1rem" }}>Played</th>
                                <th style={{ padding: "1rem" }}>Points</th>
                                <th style={{ padding: "1rem" }}>PPM</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.map((stat) => (
                                <tr key={stat.playerId} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "1rem", fontWeight: "bold" }}>#{stat.rank}</td>
                                    <td style={{ padding: "1rem" }}>
                                        <Link href={`/dashboard/operator/leagues/${id}/players/${stat.playerId}`} style={{ textDecoration: "underline", color: "inherit" }}>
                                            {stat.playerName}
                                        </Link>
                                    </td>
                                    <td style={{ padding: "1rem", fontWeight: "bold", color: "var(--primary)" }}>{stat.winRate}%</td>
                                    <td style={{ padding: "1rem" }}>{stat.matchesWon} - {stat.matchesLost}</td>
                                    <td style={{ padding: "1rem" }}>{stat.matchesPlayed}</td>
                                    <td style={{ padding: "1rem" }}>{stat.totalPoints}</td>
                                    <td style={{ padding: "1rem" }}>{stat.pointsPerMatch}</td>
                                </tr>
                            ))}
                            {stats.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#888" }}>
                                        No stats available yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
}
