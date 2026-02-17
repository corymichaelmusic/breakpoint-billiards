'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { calculateRace } from '@/utils/bbrs';

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

                    // Get Ratings (Prefer Stored Frozen Ratings, fallback to Current)
                    const p1RatingVal = match.player1_rating ?? playerRatings[match.player1_id]?.rating ?? 500;
                    const p2RatingVal = match.player2_rating ?? playerRatings[match.player2_id]?.rating ?? 500;

                    const p1Rating = { rating: p1RatingVal, confidence: playerRatings[match.player1_id]?.confidence || 0 };
                    const p2Rating = { rating: p2RatingVal, confidence: playerRatings[match.player2_id]?.confidence || 0 };

                    // Get First name / Initials
                    const p1Name = match.player1?.full_name?.toUpperCase() || "PLAYER 1";
                    const p2Name = match.player2?.full_name?.toUpperCase() || "PLAYER 2";
                    const p1Initial = p1Name.charAt(0);
                    const p2Initial = p2Name.charAt(0);

                    // Calculate Races (Use Frozen Ratings)
                    // Note: If match has `race_8ball_p1` stored, we could use that directly?
                    // But `calculateRace` is safer if we trust our formula.
                    // However, for PERFECT history, we should trust the DB columns if they are populated.
                    // The DB columns are `race_8ball_p1`, `race_8ball_p2`, etc.

                    let race8, race9;

                    if (match.race_8ball_p1 && match.race_8ball_p2 && match.race_9ball_p1 && match.race_9ball_p2) {
                        race8 = { p1: match.race_8ball_p1, p2: match.race_8ball_p2 };
                        race9 = { p1: match.race_9ball_p1, p2: match.race_9ball_p2 };
                    } else {
                        const calculated = calculateRace(p1Rating.rating, p2Rating.rating);
                        race8 = calculated.race8;
                        race9 = calculated.race9;
                    }

                    // Calculate Stats from Games (Client-Side)
                    let p1_8br = 0, p2_8br = 0;
                    let p1_9br = 0, p2_9br = 0;
                    let p1_snap = 0, p2_snap = 0;

                    if (match.games) {
                        match.games.forEach((g: any) => {
                            if (g.is_break_and_run) {
                                if (g.game_type === '8ball') {
                                    if (g.winner_id === match.player1_id) p1_8br++;
                                    else if (g.winner_id === match.player2_id) p2_8br++;
                                } else if (g.game_type === '9ball') {
                                    if (g.winner_id === match.player1_id) p1_9br++;
                                    else if (g.winner_id === match.player2_id) p2_9br++;
                                }
                            }
                            if (g.is_9_on_snap) {
                                if (g.winner_id === match.player1_id) p1_snap++;
                                else if (g.winner_id === match.player2_id) p2_snap++;
                            }
                        });
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
                                        <div className={`flex-1 flex flex-col items-center justify-center border-r border-white relative p-1 ${match.winner_id_8ball === match.player1_id ? 'bg-green-900/40' : ''}`}>
                                            <div className="absolute top-1 text-center w-full">
                                                <div className="text-white text-[8px] font-bold leading-none mt-[1px] opacity-70">RACE TO {race8.p1}</div>
                                            </div>
                                            <div className={`font-bold text-2xl sm:text-3xl mt-2 ${match.winner_id_8ball === match.player1_id ? 'text-green-400' : 'text-[#D4AF37]'}`}>{match.points_8ball_p1 || 0}</div>
                                            {match.winner_id_8ball === match.player1_id && <div className="absolute bottom-1 text-[8px] font-bold text-green-400">WINNER</div>}
                                        </div>
                                        {/* P2 Score */}
                                        <div className={`flex-1 flex flex-col items-center justify-center relative p-1 ${match.winner_id_8ball === match.player2_id ? 'bg-green-900/40' : ''}`}>
                                            <div className="absolute top-1 text-center w-full">
                                                <div className="text-white text-[8px] font-bold leading-none mt-[1px] opacity-70">RACE TO {race8.p2}</div>
                                            </div>
                                            <div className={`font-bold text-2xl sm:text-3xl mt-2 ${match.winner_id_8ball === match.player2_id ? 'text-green-400' : 'text-[#D4AF37]'}`}>{match.points_8ball_p2 || 0}</div>
                                            {match.winner_id_8ball === match.player2_id && <div className="absolute bottom-1 text-[8px] font-bold text-green-400">WINNER</div>}
                                        </div>
                                    </div>
                                    {/* 8-Ball Status */}
                                    <div className="text-center mt-1">
                                        {match.status_8ball === 'finalized' ? (
                                            <span className="text-[9px] font-bold text-green-400 uppercase">FINAL</span>
                                        ) : match.status_8ball === 'in_progress' ? (
                                            <span className="text-[9px] font-bold text-yellow-400 uppercase">IN PROGRESS</span>
                                        ) : (
                                            <span className="text-[9px] font-bold text-gray-500 uppercase">SCHEDULED</span>
                                        )}
                                    </div>
                                </div>

                                {/* 9-Ball Box */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <h4 className="text-[#D4AF37] font-bold text-center mb-1 text-[10px] tracking-wider">9-BALL</h4>
                                    <div className="flex-1 border border-white flex relative min-h-0">
                                        {/* P1 Score */}
                                        <div className={`flex-1 flex flex-col items-center justify-center border-r border-white relative p-1 ${match.winner_id_9ball === match.player1_id ? 'bg-green-900/40' : ''}`}>
                                            <div className="absolute top-1 text-center w-full">
                                                <div className="text-white text-[8px] font-bold leading-none mt-[1px] opacity-70">RACE TO {race9.p1}</div>
                                            </div>
                                            <div className={`font-bold text-2xl sm:text-3xl mt-2 ${match.winner_id_9ball === match.player1_id ? 'text-green-400' : 'text-[#D4AF37]'}`}>{match.points_9ball_p1 || 0}</div>
                                            {match.winner_id_9ball === match.player1_id && <div className="absolute bottom-1 text-[8px] font-bold text-green-400">WINNER</div>}
                                        </div>
                                        {/* P2 Score */}
                                        <div className={`flex-1 flex flex-col items-center justify-center relative p-1 ${match.winner_id_9ball === match.player2_id ? 'bg-green-900/40' : ''}`}>
                                            <div className="absolute top-1 text-center w-full">
                                                <div className="text-white text-[8px] font-bold leading-none mt-[1px] opacity-70">RACE TO {race9.p2}</div>
                                            </div>
                                            <div className={`font-bold text-2xl sm:text-3xl mt-2 ${match.winner_id_9ball === match.player2_id ? 'text-green-400' : 'text-[#D4AF37]'}`}>{match.points_9ball_p2 || 0}</div>
                                            {match.winner_id_9ball === match.player2_id && <div className="absolute bottom-1 text-[8px] font-bold text-green-400">WINNER</div>}
                                        </div>
                                    </div>
                                    {/* 9-Ball Status */}
                                    <div className="text-center mt-1">
                                        {match.status_9ball === 'finalized' ? (
                                            <span className="text-[9px] font-bold text-green-400 uppercase">FINAL</span>
                                        ) : match.status_9ball === 'in_progress' ? (
                                            <span className="text-[9px] font-bold text-yellow-400 uppercase">IN PROGRESS</span>
                                        ) : (
                                            <span className="text-[9px] font-bold text-gray-500 uppercase">SCHEDULED</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Stats Footer */}
                            <div className="flex gap-2 mt-3">
                                {/* P1 Stats */}
                                <div className="flex-1 bg-white/5 rounded p-2 border border-white/10">
                                    <h5 className="text-[#D4AF37] text-[10px] font-bold text-center mb-1 truncate">{p1Name}</h5>
                                    <div className="flex flex-col gap-[1px]">
                                        <div className="flex justify-between items-center text-[9px]">
                                            <span className="text-gray-400 font-bold">8BR</span>
                                            <span className="text-white font-mono font-bold">{p1_8br}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[9px]">
                                            <span className="text-gray-400 font-bold">9BR</span>
                                            <span className="text-white font-mono font-bold">{p1_9br}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[9px]">
                                            <span className="text-gray-400 font-bold">9BS</span>
                                            <span className="text-white font-mono font-bold">{p1_snap}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* P2 Stats */}
                                <div className="flex-1 bg-white/5 rounded p-2 border border-white/10">
                                    <h5 className="text-[#D4AF37] text-[10px] font-bold text-center mb-1 truncate">{p2Name}</h5>
                                    <div className="flex flex-col gap-[1px]">
                                        <div className="flex justify-between items-center text-[9px]">
                                            <span className="text-gray-400 font-bold">8BR</span>
                                            <span className="text-white font-mono font-bold">{p2_8br}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[9px]">
                                            <span className="text-gray-400 font-bold">9BR</span>
                                            <span className="text-white font-mono font-bold">{p2_9br}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[9px]">
                                            <span className="text-gray-400 font-bold">9BS</span>
                                            <span className="text-white font-mono font-bold">{p2_snap}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {
                    filteredMatches.length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-500 italic">No matches for this week.</div>
                    )
                }
            </div >
        </div >
    );

}
