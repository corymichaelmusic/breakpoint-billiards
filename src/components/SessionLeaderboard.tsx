'use client';

import { useState } from 'react';
import Link from 'next/link';
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
};

type Props = {
    sessionId: string;
    sessionName: string;
    initialStats: PlayerStats[];
    totalPlayers: number; // To know if we should show "View Top 25"
    limit: number; // The configured limit (e.g. 25)
    enablePlayerLinks?: boolean;
};

export default function SessionLeaderboard({ sessionId, sessionName, initialStats, totalPlayers, limit, enablePlayerLinks = false }: Props) {
    const [stats, setStats] = useState<PlayerStats[]>(initialStats);
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
            const { getSessionLeaderboard } = await import("@/app/actions/stats-actions");
            // Pass 0 to get ALL players
            const allStats = await getSessionLeaderboard(sessionId, 0);
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
                        Top players by Win %
                    </p>
                </div>
            </div>

            <div style={{ maxWidth: "100%" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", tableLayout: "fixed" }}>
                    <thead>
                        <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                            <th style={{ padding: "0.5rem", width: "15%", textAlign: "center" }}>Rank</th>
                            <th style={{ padding: "0.5rem", width: "60%", textAlign: "left" }}>Player</th>
                            <th style={{ padding: "0.5rem", width: "25%", textAlign: "right" }}>Win %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.map((player) => (
                            <tr
                                key={player.playerId}
                                style={{
                                    borderBottom: "1px solid var(--border)",
                                    cursor: enablePlayerLinks ? "pointer" : "default",
                                    transition: "background-color 0.2s"
                                }}
                                className={enablePlayerLinks ? "hover:bg-surface-hover" : ""}
                                onClick={() => {
                                    if (enablePlayerLinks) {
                                        router.push(`/dashboard/operator/leagues/${sessionId}/players/${player.playerId}`);
                                    }
                                }}
                            >
                                <td style={{ padding: "0.5rem", textAlign: "center", fontWeight: "bold", color: player.rank === 1 ? "#D4AF37" : "inherit" }}>
                                    {player.rank}
                                </td>
                                <td style={{ padding: "0.5rem", fontWeight: "600", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {player.playerName}
                                </td>
                                <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "bold" }}>
                                    {player.winRate}%
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
                        {loading ? "Loading..." : (isExpanded ? "Show Top 5" : "View All Players")}
                    </button>
                </div>
            )}
        </div>
    );
}
