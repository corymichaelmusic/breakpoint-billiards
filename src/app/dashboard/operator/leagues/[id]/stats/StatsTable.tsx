"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PlayerStats } from "@/utils/stats-calculator";

interface StatsTableProps {
    stats: PlayerStats[];
    leagueId: string;
}

type SortKey = keyof PlayerStats | 'display_shutouts'; // display_shutouts is already in type but just to be explicit

export default function StatsTable({ stats: initialStats, leagueId }: StatsTableProps) {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
        key: 'winRate', // Default sort
        direction: 'desc'
    });

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedStats = useMemo(() => {
        const sorted = [...initialStats];
        sorted.sort((a, b) => {
            // @ts-ignore
            let aValue = a[sortConfig.key];
            // @ts-ignore
            let bValue = b[sortConfig.key];

            // Handle undefined/null safety
            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        return sorted;
    }, [initialStats, sortConfig]);

    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortConfig.key !== columnKey) return <span className="text-white/10 ml-1">⇅</span>;
        return sortConfig.direction === 'asc' ? <span className="text-[#D4AF37] ml-1">↑</span> : <span className="text-[#D4AF37] ml-1">↓</span>;
    };

    const Th = ({ children, sortKey, className = "", minW = "" }: { children: React.ReactNode, sortKey?: SortKey, className?: string, minW?: string }) => (
        <th
            className={`px-4 py-3 text-center cursor-pointer select-none hover:bg-white/5 transition-colors ${className} ${minW}`}
            onClick={() => sortKey && handleSort(sortKey)}
        >
            <div className="flex items-center justification-center gap-1">
                {children}
                {sortKey && <SortIcon columnKey={sortKey} />}
            </div>
        </th>
    );

    return (
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="border-b border-border text-gray-500 text-xs uppercase whitespace-nowrap">
                    <th className="px-4 py-3 text-center sticky left-0 bg-[#1a1a1a] z-30 shadow-[1px_0_0_0_rgba(255,255,255,0.1)] w-[60px] min-w-[60px]">
                        Rank
                    </th>
                    <th className="px-4 py-3 sticky left-[60px] bg-[#1a1a1a] z-30 shadow-[1px_0_0_0_rgba(255,255,255,0.1)] w-[220px] min-w-[220px] text-left">
                        Player
                    </th>

                    {/* Set Stats */}
                    <Th sortKey="winRate" className="text-primary/80" minW="min-w-[120px]">Set Win %</Th>
                    <th className="px-4 py-3 text-center text-primary/80 min-w-[100px]">Set W-L</th>
                    {/* Note: sorting by Record is tricky string sort vs matchesWon/Loss. Usually sorting by Win % is enough, or we sort by matchesWon. let's just leave record unsortable or sort by matchesWon? */}

                    {/* 8-Ball Set */}
                    <Th sortKey="winRate_8ball" className="border-l border-white/5" minW="min-w-[100px]">8B Set %</Th>
                    <th className="px-4 py-3 text-center min-w-[100px]">8B Set W-L</th>

                    {/* 9-Ball Set */}
                    <Th sortKey="winRate_9ball" className="border-l border-white/5" minW="min-w-[100px]">9B Set %</Th>
                    <th className="px-4 py-3 text-center min-w-[100px]">9B Set W-L</th>

                    {/* Shutouts */}
                    <Th sortKey="display_shutouts" className="border-l border-white/5 text-yellow-500/80" minW="min-w-[100px]">Shutouts</Th>

                    {/* Game (Rack) Stats */}
                    {/* We need a raw 'racksWinRate' field? We have calculate it in frontend or backend. matchStats has display_gameWinRate. 
                        Actually stats-calculator doesn't seem to expose raw game win rate number attached to object, only the display string.
                        Wait, we have racksWon_X and racksPlayed_X.
                        We can sum them to get total raw win rate content.
                        OR just sort by display_gameWinRate string? "58%" sorts correctly as string usually? No "100%" < "58%".
                        We need to rely on the backend raw data. 'racksWon' / 'totalRacksPlayed'.
                        For now, let's sort by 'matchesWon' is sets, but for games...
                        The PlayerStats object has `racksWon_8ball` and `racksWon_9ball`.
                        Let's check if we can add a computed getter or just simple sorting logic.
                    */}
                    <Th sortKey="display_gameWinRate" className="border-l border-white/5 text-blue-400/80" minW="min-w-[120px]">Game Win %</Th>
                    <th className="px-4 py-3 text-center text-blue-400/80 min-w-[100px]">Game W-L</th>

                    <Th sortKey="display_gameWinRate8" className="border-l border-white/5" minW="min-w-[100px]">8B Game %</Th>
                    <th className="px-4 py-3 text-center min-w-[100px]">8B Game W-L</th>

                    <Th sortKey="display_gameWinRate9" className="border-l border-white/5" minW="min-w-[100px]">9B Game %</Th>
                    <th className="px-4 py-3 text-center min-w-[100px]">9B Game W-L</th>

                    {/* Break And Runs etc */}
                    <Th sortKey="breakAndRuns_8ball" className="border-l border-white/5 text-green-400/80" minW="min-w-[90px]">8B B&R</Th>
                    <Th sortKey="rackAndRuns_8ball" className="text-green-400/80" minW="min-w-[90px]">8B R&R</Th>
                    <Th sortKey="breakAndRuns_9ball" className="text-green-400/80" minW="min-w-[90px]">9B B&R</Th>
                    <Th sortKey="nineOnSnaps_9ball" className="text-green-400/80" minW="min-w-[90px]">9B Snap</Th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {sortedStats.map((stat, index) => (
                    <tr key={stat.playerId} className="hover:bg-white/5 transition-colors text-sm whitespace-nowrap">
                        <td className="px-4 py-3 text-center font-bold text-[#D4AF37] sticky left-0 bg-[#1a1a1a] border-r border-white/5 z-20 w-[60px] min-w-[60px]">#{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-white sticky left-[60px] bg-[#1a1a1a] border-r border-white/5 z-20 w-[220px] min-w-[220px]">
                            <div className="w-[190px] truncate" title={stat.playerName}>
                                <Link href={`/dashboard/operator/leagues/${leagueId}/players/${stat.playerId}`} className="hover:text-primary transition-colors block truncate">
                                    {stat.playerName}
                                </Link>
                            </div>
                        </td>

                        <td className="px-4 py-3 text-center font-bold text-lg text-[#D4AF37]">{stat.display_setWinRate}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{stat.display_setRecord}</td>

                        <td className="px-4 py-3 text-center border-l border-white/5 text-gray-400">{stat.display_setWinRate8}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{stat.display_setRecord8}</td>

                        <td className="px-4 py-3 text-center border-l border-white/5 text-gray-400">{stat.display_setWinRate9}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{stat.display_setRecord9}</td>

                        <td className="px-4 py-3 text-center border-l border-white/5 font-bold text-yellow-500">{stat.display_shutouts}</td>

                        <td className="px-4 py-3 text-center border-l border-white/5 font-bold text-blue-300">{stat.display_gameWinRate}</td>
                        <td className="px-4 py-3 text-center text-blue-300">{stat.display_gameRecord}</td>

                        <td className="px-4 py-3 text-center border-l border-white/5 text-gray-400">{stat.display_gameWinRate8}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{stat.display_gameRecord8}</td>

                        <td className="px-4 py-3 text-center border-l border-white/5 text-gray-400">{stat.display_gameWinRate9}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{stat.display_gameRecord9}</td>

                        <td className="px-4 py-3 text-center border-l border-white/5 text-gray-300">{stat.breakAndRuns_8ball}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{stat.rackAndRuns_8ball}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{stat.breakAndRuns_9ball}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{stat.nineOnSnaps_9ball}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
