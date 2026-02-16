'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { calculateRace } from '@/utils/race-utils';

interface MatchesViewProps {
    matches: any[];
    leagueId: string;
    leagueStatus: string;
    timezone: string;
    playerRatings: Record<string, { rating: number, confidence: number }>;
}

export default function MatchesView({ matches, leagueId, leagueStatus, timezone, playerRatings }: MatchesViewProps) {
    const [selectedWeek, setSelectedWeek] = useState<number | 'all'>('all');

    const hasMatches = matches && matches.length > 0;

    // Get unique weeks
    const weeks = useMemo(() => {
        if (!hasMatches) return [];
        const w = new Set(matches.map(m => m.week_number));
        return Array.from(w).sort((a, b) => (a as number) - (b as number));
    }, [matches, hasMatches]);

    // Filter matches
    const filteredMatches = useMemo(() => {
        if (selectedWeek === 'all') return matches;
        return matches.filter(m => m.week_number === selectedWeek);
    }, [matches, selectedWeek]);


    if (!hasMatches) {
        return (
            <div className="card-glass p-6 text-center py-8 text-gray-500 italic">
                No matches scheduled.
            </div>
        );
    }

    return (
        <div className="card-glass p-6">
            <div className="flex flex-col gap-4 mb-6">
                {/* Header Row: Title & View Toggle */}
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-4">
                        Table View
                    </h2>
                    <div className="flex gap-2">
                        <Link href={`/dashboard/operator/leagues/${leagueId}`} className="btn bg-white hover:bg-gray-200 border border-white text-xs px-3 py-1 font-bold rounded transition-colors text-black shadow-lg shadow-white/10">
                            &larr; Back to List
                        </Link>
                        {leagueStatus === 'active' && (
                            <form action={async () => {
                                const { submitLeagueResults } = await import("@/app/actions/league-actions");
                                await submitLeagueResults(leagueId);
                            }}>
                                <button className="btn text-xs px-3 py-1 font-bold" style={{ backgroundColor: '#D4AF37', color: 'black', border: '1px solid #D4AF37' }}>End Season</button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Week Tabs */}
                {weeks.length > 0 && (
                    <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
                        <button
                            onClick={() => setSelectedWeek('all')}
                            className={`px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-all ${selectedWeek === 'all'
                                ? '!bg-white !text-black border-white'
                                : 'border-transparent !text-white hover:bg-white/5'
                                }`}
                        >
                            All Weeks
                        </button>
                        {weeks.map(week => (
                            <button
                                key={week as number}
                                onClick={() => setSelectedWeek(week as number)}
                                className={`px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-all ${selectedWeek === week
                                    ? '!bg-white !text-black border-white'
                                    : 'border-transparent !text-white hover:bg-white/5'
                                    }`}
                            >
                                Week {week as number}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredMatches.map((match) => {
                    const hasPoints = (match.points_8ball_p1 || 0) > 0 || (match.points_8ball_p2 || 0) > 0 || (match.points_9ball_p1 || 0) > 0 || (match.points_9ball_p2 || 0) > 0;
                    const is8BallDone = match.status_8ball === 'finalized';
                    const is9BallDone = match.status_9ball === 'finalized';

                    let effectiveStatus = match.status;
                    if (is8BallDone && is9BallDone) {
                        effectiveStatus = 'finalized';
                    } else if (match.status === 'scheduled' && (match.started_at || hasPoints)) {
                        effectiveStatus = 'in_progress';
                    }

                    const isStarted = effectiveStatus === 'in_progress' || effectiveStatus === 'finalized';

                    // Get Ratings
                    const p1Rating = playerRatings[match.player1_id] || { rating: 500, confidence: 0 };
                    const p2Rating = playerRatings[match.player2_id] || { rating: 500, confidence: 0 };

                    // Get First name / Initials
                    const p1Name = match.player1?.full_name?.toUpperCase() || "PLAYER 1";
                    const p2Name = match.player2?.full_name?.toUpperCase() || "PLAYER 2";
                    const p1Initial = p1Name.charAt(0);
                    const p2Initial = p2Name.charAt(0);

                    // Calculate Races
                    const race8 = calculateRace(p1Rating.rating, p2Rating.rating, '8ball');
                    const race9 = calculateRace(p1Rating.rating, p2Rating.rating, '9ball');

                    // Winner status logic
                    let statusText = "SCHEDULED";
                    let statusColor = "text-gray-500";

                    if (effectiveStatus === 'in_progress') {
                        statusText = "IN PROGRESS";
                        statusColor = "text-[#D4AF37]"; // Gold
                    } else if (effectiveStatus === 'finalized') {
                        statusText = "FINALIZED";
                        statusColor = "text-[#4ade80]"; // Green
                    }

                    if (effectiveStatus === 'finalized') {
                        const p1Total = (match.points_8ball_p1 || 0) + (match.points_9ball_p1 || 0);
                        const p2Total = (match.points_8ball_p2 || 0) + (match.points_9ball_p2 || 0);

                        if (p1Total > p2Total) {
                            statusText = `${p1Name.split(' ')[0]} WINS`;
                        } else if (p2Total > p1Total) {
                            statusText = `${p2Name.split(' ')[0]} WINS`;
                        } else {
                            statusText = "DRAW";
                        }
                    }

                    return (
                        <div key={match.id} className="relative w-full aspect-[2/1] bg-black border-[3px] border-white p-3 flex flex-col justify-between shadow-xl shadow-black/50">
                            {/* Top Section: Header */}
                            <div className="flex justify-between items-start text-center mb-1">
                                {/* P1 Stats */}
                                <div className="flex-1 flex flex-col items-center">
                                    <h3 className="text-[#D4AF37] font-bold text-xs sm:text-sm leading-none mb-1 tracking-wide truncate w-full">{p1Name}</h3>
                                    <span className="text-white font-bold text-[10px] sm:text-xs">{(Math.floor(p1Rating.rating / 10) / 10).toFixed(1)} ({p1Rating.confidence})</span>
                                </div>

                                {/* VS / Table */}
                                <div className="flex flex-col items-center justify-start mx-2 mt-1">
                                    <span className="text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap bg-white/10 px-2 py-0.5 rounded">{match.table_name || "TBD"}</span>
                                </div>

                                {/* P2 Stats */}
                                <div className="flex-1 flex flex-col items-center">
                                    <h3 className="text-[#D4AF37] font-bold text-xs sm:text-sm leading-none mb-1 tracking-wide truncate w-full">{p2Name}</h3>
                                    <span className="text-white font-bold text-[10px] sm:text-xs">{(Math.floor(p2Rating.rating / 10) / 10).toFixed(1)} ({p2Rating.confidence})</span>
                                </div>
                            </div>

                            {/* Divider Line */}
                            <div className="w-full h-[1px] bg-[#D4AF37]/50 mb-2"></div>

                            {/* Games Section */}
                            <div className="flex-1 flex gap-2 min-h-0">
                                {/* 8-Ball Box */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <h4 className="text-[#D4AF37] font-bold text-center mb-1 text-[10px] tracking-wider">8-BALL</h4>
                                    <div className="flex-1 border border-white flex relative min-h-0">
                                        {/* P1 Score */}
                                        <div className="flex-1 flex flex-col items-center justify-center border-r border-white relative p-1">
                                            <div className="absolute top-1 text-center w-full">
                                                <div className="text-white text-[8px] font-bold leading-none mt-[1px] opacity-70">RACE TO {race8.p1}</div>
                                            </div>
                                            <div className="text-[#D4AF37] font-bold text-2xl sm:text-3xl mt-2">{match.points_8ball_p1 || 0}</div>
                                        </div>
                                        {/* P2 Score */}
                                        <div className="flex-1 flex flex-col items-center justify-center relative p-1">
                                            <div className="absolute top-1 text-center w-full">
                                                <div className="text-white text-[8px] font-bold leading-none mt-[1px] opacity-70">RACE TO {race8.p2}</div>
                                            </div>
                                            <div className="text-[#D4AF37] font-bold text-2xl sm:text-3xl mt-2">{match.points_8ball_p2 || 0}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* 9-Ball Box */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <h4 className="text-[#D4AF37] font-bold text-center mb-1 text-[10px] tracking-wider">9-BALL</h4>
                                    <div className="flex-1 border border-white flex relative min-h-0">
                                        {/* P1 Score */}
                                        <div className="flex-1 flex flex-col items-center justify-center border-r border-white relative p-1">
                                            <div className="absolute top-1 text-center w-full">
                                                <div className="text-white text-[8px] font-bold leading-none mt-[1px] opacity-70">RACE TO {race9.p1}</div>
                                            </div>
                                            <div className="text-[#D4AF37] font-bold text-2xl sm:text-3xl mt-2">{match.points_9ball_p1 || 0}</div>
                                        </div>
                                        {/* P2 Score */}
                                        <div className="flex-1 flex flex-col items-center justify-center relative p-1">
                                            <div className="absolute top-1 text-center w-full">
                                                <div className="text-white text-[8px] font-bold leading-none mt-[1px] opacity-70">RACE TO {race9.p2}</div>
                                            </div>
                                            <div className="text-[#D4AF37] font-bold text-2xl sm:text-3xl mt-2">{match.points_9ball_p2 || 0}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Status */}
                            <div className={`text-center font-bold tracking-widest text-xs mt-2 uppercase ${statusColor}`}>
                                {statusText}
                            </div>

                            {/* Link Overlay (Full Card Click) */}
                            {(leagueStatus === 'active' || leagueStatus === 'completed') && (
                                <Link href={`/dashboard/operator/leagues/${leagueId}/matches/${match.id}/score`} className="absolute inset-0 z-20 cursor-pointer" title="Go to Scoreboard"></Link>
                            )}
                        </div>
                    );
                })}
                {filteredMatches.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500 italic">No matches for this week.</div>
                )}
            </div>
        </div>
    );

}
