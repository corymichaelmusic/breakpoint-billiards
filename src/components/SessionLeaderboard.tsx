'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type PlayerStats = {
    playerId: string;
    playerName: string;
    matchesPlayed: number;
    matchesWon: number;
    matchesLost: number;
    winRate: number;
    totalPoints: number;
    pointsPerMatch: string;
    breakPoint?: number;
    rank?: number;
    breakAndRuns_8ball?: number;
    rackAndRuns_8ball?: number;
    breakAndRuns_9ball?: number;
    rackAndRuns_9ball?: number;
    winZips_9ball?: number;
    nineOnSnaps_9ball?: number;
    display_shutouts?: number;
};

type TeamStats = {
    teamId: string;
    teamName: string;
    wins: number;
    losses: number;
    played: number;
    winRate: number;
    shutouts: number;
    rank?: number;
};

type Props = {
    sessionId: string;
    sessionName: string;
    initialStats: PlayerStats[] | TeamStats[];
    totalPlayers: number; // To know if we should show "View All"
    limit: number; // The configured limit (e.g. 25)
    enablePlayerLinks?: boolean;
    isTeamLeague?: boolean;
};

export default function SessionLeaderboard({ sessionId, sessionName, initialStats, totalPlayers, limit, enablePlayerLinks = false, isTeamLeague = false }: Props) {
    const [stats, setStats] = useState<(PlayerStats | TeamStats)[]>(initialStats);
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleToggle = async () => {
        if (isExpanded) {
            // Collapse
            setStats(initialStats);
            setIsExpanded(false);
            return;
        }

        // Expand
        setLoading(true);
        try {
            const { getSessionLeaderboard, getTeamSessionLeaderboard } = await import("@/app/actions/stats-actions");
            const allStats = isTeamLeague
                ? await getTeamSessionLeaderboard(sessionId, 0)
                : await getSessionLeaderboard(sessionId, 0);
            setStats(allStats);
            setIsExpanded(true);
        } catch (error) {
            console.error("Failed to fetch leaderboard", error);
        } finally {
            setLoading(false);
        }
    };

    if (!stats || stats.length === 0) {
        return (
            <div className="card" style={{ padding: "2rem", textAlign: "center", color: "#888" }}>
                <p>No matches played in this session yet.</p>
            </div>
        );
    }

    return (
        <div className="card" style={{ padding: "0", maxWidth: "100%", overflow: "hidden", color: "white" }}>
            <div style={{ padding: "1rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                        Session Leaderboard
                    </h3>
                    <p style={{ color: "#888", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                        {isTeamLeague ? "Top teams by Win %" : "Top players by Win %"}
                    </p>
                </div>
            </div>

            <div style={{ maxWidth: "100%" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", tableLayout: "fixed" }}>
                    <thead>
                        <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                            <th style={{ padding: "0.5rem", width: "15%", textAlign: "center" }}>Rank</th>
                            <th style={{ padding: "0.5rem", width: "45%", textAlign: "left" }}>{isTeamLeague ? "Team" : "Player"}</th>
                            <th style={{ padding: "0.5rem", width: "20%", textAlign: "right" }}>Win %</th>
                            <th style={{ padding: "0.5rem", width: "20%", textAlign: "right" }}>SO</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.map((entry) => (
                            <tr
                                key={isTeamLeague ? (entry as TeamStats).teamId : (entry as PlayerStats).playerId}
                                style={{
                                    borderBottom: "1px solid var(--border)",
                                    cursor: !isTeamLeague && enablePlayerLinks ? "pointer" : "default",
                                    transition: "background-color 0.2s"
                                }}
                                className={!isTeamLeague && enablePlayerLinks ? "hover:bg-surface-hover" : ""}
                                onClick={() => {
                                    if (!isTeamLeague && enablePlayerLinks) {
                                        router.push(`/dashboard/operator/leagues/${sessionId}/players/${(entry as PlayerStats).playerId}`);
                                    }
                                }}
                            >
                                <td style={{ padding: "0.5rem", textAlign: "center", fontWeight: "bold", color: entry.rank === 1 ? "#D4AF37" : "inherit" }}>
                                    {entry.rank}
                                </td>
                                <td style={{ padding: "0.5rem", fontWeight: "600", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {isTeamLeague ? (entry as TeamStats).teamName : (entry as PlayerStats).playerName}
                                </td>
                                <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "bold" }}>
                                    {entry.winRate}%
                                </td>
                                <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "bold", color: "#D4AF37" }}>
                                    {isTeamLeague ? (entry as TeamStats).shutouts || 0 : (entry as PlayerStats).display_shutouts || 0}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {(totalPlayers > initialStats.length) && (
                <div style={{ padding: "0.75rem", textAlign: "center", borderTop: "1px solid var(--border)" }}>
                    <button
                        onClick={handleToggle}
                        className="btn btn-secondary"
                        disabled={loading}
                        style={{ width: "100%", fontSize: "0.8rem", padding: "0.5rem" }}
                    >
                        {loading ? "Loading..." : (isExpanded ? "Show Top 5" : `View All ${isTeamLeague ? "Teams" : "Players"}`)}
                    </button>
                </div>
            )}
        </div>
    );
}
