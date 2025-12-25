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
    const [viewMode, setViewMode] = useState<'session' | 'global'>('session');
    const router = useRouter();

    const handleModeSwitch = async (mode: 'session' | 'global') => {
        if (mode === viewMode) return;
        setViewMode(mode);

        if (mode === 'session') {
            setStats(initialStats);
            setIsExpanded(false);
            return;
        }

        setLoading(true);
        try {
            const { getGlobalLeaderboard } = await import("@/app/actions/stats-actions");
            const globalStats = await getGlobalLeaderboard(limit);
            setStats(globalStats);
            setIsExpanded(false); // Reset expansion for global view
        } catch (error) {
            console.error("Failed to fetch global leaderboard", error);
        } finally {
            setLoading(false);
        }
    };

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
        <div className="card" style={{ padding: "0", maxWidth: "100%", overflow: "hidden" }}>
            <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: "1.25rem" }}>
                        {viewMode === 'session' ? `${sessionName} Leaderboard` : "Global Leaderboard"}
                    </h3>
                    <p style={{ color: "#888", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                        Top players by Win %
                    </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", background: "var(--background)", padding: "0.25rem", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                    <button
                        onClick={() => handleModeSwitch('session')}
                        style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "var(--radius)",
                            border: "none",
                            background: viewMode === 'session' ? "var(--primary)" : "transparent",
                            color: viewMode === 'session' ? "#000" : "#888",
                            fontWeight: "bold",
                            cursor: "pointer",
                            fontSize: "0.8rem"
                        }}
                    >
                        Session
                    </button>
                    <button
                        onClick={() => handleModeSwitch('global')}
                        style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "var(--radius)",
                            border: "none",
                            background: viewMode === 'global' ? "var(--primary)" : "transparent",
                            color: viewMode === 'global' ? "#000" : "#888",
                            fontWeight: "bold",
                            cursor: "pointer",
                            fontSize: "0.8rem"
                        }}
                    >
                        Global
                    </button>
                </div>
            </div>

            <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                        <tr style={{ background: "var(--surface)", textAlign: "left" }}>
                            <th style={{ padding: "1rem", width: "60px", textAlign: "center", position: "sticky", left: 0, zIndex: 20, background: "var(--surface)" }}>Rank</th>
                            <th style={{ padding: "1rem", position: "sticky", left: "60px", zIndex: 20, background: "var(--surface)", borderRight: "1px solid var(--border)" }}>Player</th>
                            <th style={{ padding: "1rem", textAlign: "center" }}>Win %</th>
                            <th style={{ padding: "1rem", textAlign: "center" }}>W - L</th>
                            <th style={{ padding: "1rem", textAlign: "center" }}>PPM</th>
                            <th style={{ padding: "1rem", textAlign: "center" }}>BreakPoint</th>
                            <th style={{ padding: "1rem", textAlign: "center", borderLeft: "1px solid var(--border)" }}>8-Ball B&R</th>
                            <th style={{ padding: "1rem", textAlign: "center" }}>8-Ball R&R</th>
                            <th style={{ padding: "1rem", textAlign: "center", borderLeft: "1px solid var(--border)" }}>9-Ball B&R</th>
                            <th style={{ padding: "1rem", textAlign: "center" }}>9-Ball Snap</th>
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
                                <td style={{ padding: "1rem", textAlign: "center", fontWeight: "bold", color: player.rank === 1 ? "var(--primary)" : "inherit", position: "sticky", left: 0, zIndex: 10, background: "var(--surface)" }}>
                                    {player.rank}
                                </td>
                                <td style={{ padding: "1rem", fontWeight: "600", position: "sticky", left: "60px", zIndex: 10, background: "var(--surface)", borderRight: "1px solid var(--border)" }}>
                                    {player.playerName}
                                </td>
                                <td style={{ padding: "1rem", textAlign: "center", fontWeight: "bold" }}>
                                    {player.winRate}%
                                </td>
                                <td style={{ padding: "1rem", textAlign: "center", color: "#888" }}>
                                    {player.matchesWon} - {player.matchesLost}
                                </td>
                                <td style={{ padding: "1rem", textAlign: "center", color: "#888" }}>
                                    {player.pointsPerMatch}
                                </td>
                                <td style={{ padding: "1rem", textAlign: "center", fontWeight: "bold", color: "var(--primary)" }}>
                                    {player.breakPoint || '-'}
                                </td>
                                <td style={{ padding: "1rem", textAlign: "center", borderLeft: "1px solid var(--border)" }}>
                                    {player.breakAndRuns_8ball || '-'}
                                </td>
                                <td style={{ padding: "1rem", textAlign: "center" }}>
                                    {player.rackAndRuns_8ball || '-'}
                                </td>
                                <td style={{ padding: "1rem", textAlign: "center", borderLeft: "1px solid var(--border)" }}>
                                    {player.breakAndRuns_9ball || '-'}
                                </td>
                                <td style={{ padding: "1rem", textAlign: "center" }}>
                                    {player.nineOnSnaps_9ball || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {(totalPlayers > initialStats.length) && (
                <div style={{ padding: "1rem", textAlign: "center", borderTop: "1px solid var(--border)" }}>
                    <button
                        onClick={handleToggle}
                        className="btn btn-secondary"
                        disabled={loading}
                        style={{ width: "100%" }}
                    >
                        {loading ? "Loading..." : (isExpanded ? "Show Top 5" : "View All Players")}
                    </button>
                </div>
            )}
        </div>
    );
}
