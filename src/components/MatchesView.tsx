'use client';

import { useState } from 'react';
import Link from 'next/link';
import MatchDateManager from '@/components/MatchDateManager';
import PaymentStatusManager from '@/components/PaymentStatusManager';
import ResetMatchButton from '@/components/ResetMatchButton';
import { isMatchDateLocked } from '@/utils/match-utils';
import { calculateRace } from '@/utils/race-utils';

interface MatchesViewProps {
    matches: any[];
    leagueId: string;
    leagueStatus: string;
    timezone: string;
    playerRatings: Record<string, { rating: number, confidence: number }>;
}

export default function MatchesView({ matches, leagueId, leagueStatus, timezone, playerRatings }: MatchesViewProps) {
    const [viewMode, setViewMode] = useState<'list' | 'table'>('list');

    const hasMatches = matches && matches.length > 0;

    if (!hasMatches) {
        return (
            <div className="card-glass p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Matches</h2>
                </div>
                <div className="text-center py-8 text-gray-500 italic">
                    No matches scheduled.
                </div>
            </div>
        );
    }

    return (
        <div className="card-glass p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-4">
                    Matches
                    <div className="flex bg-surface rounded-lg p-1 border border-border">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${viewMode === 'list' ? 'bg-[#D4AF37] text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            List
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${viewMode === 'table' ? 'bg-[#D4AF37] text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            Table View
                        </button>
                    </div>
                </h2>
                {leagueStatus === 'active' && (
                    <form action={async () => {
                        const { submitLeagueResults } = await import("@/app/actions/league-actions");
                        await submitLeagueResults(leagueId);
                    }}>
                        <button className="btn text-xs px-3 py-1 font-bold" style={{ backgroundColor: '#D4AF37', color: 'black', border: '1px solid #D4AF37' }}>End Season</button>
                    </form>
                )}
            </div>

            {viewMode === 'list' ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border text-gray-500 text-xs uppercase">
                                <th className="p-2">Wk</th>
                                <th className="p-2">Date</th>
                                <th className="p-2">Matchup</th>
                                <th className="p-2">Status</th>
                                <th className="p-2">Scores</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {matches.map((match, index) => {
                                const hasPoints = (match.points_8ball_p1 || 0) > 0 || (match.points_8ball_p2 || 0) > 0 || (match.points_9ball_p1 || 0) > 0 || (match.points_9ball_p2 || 0) > 0;
                                const is8BallDone = match.status_8ball === 'finalized';
                                const is9BallDone = match.status_9ball === 'finalized';

                                // Check if likely near bottom of viewport
                                const isNearBottom = index >= matches.length - 4;

                                let effectiveStatus = match.status;
                                if (is8BallDone && is9BallDone) {
                                    effectiveStatus = 'finalized';
                                } else if (match.status === 'scheduled' && (match.started_at || hasPoints)) {
                                    effectiveStatus = 'in_progress';
                                }

                                return (
                                    <tr key={match.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-2 font-mono text-gray-400">{match.week_number}</td>
                                        <td className="p-2 text-sm">
                                            <MatchDateManager
                                                matchId={match.id}
                                                initialDate={match.scheduled_date}
                                                initialTime={match.scheduled_time}
                                                initialTable={match.table_name}
                                                isUnlocked={match.is_manually_unlocked}
                                                isDateLocked={isMatchDateLocked(match.scheduled_date, timezone || 'America/Chicago').locked}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <div className="flex flex-col gap-1 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <PaymentStatusManager matchId={match.id} playerId={match.player1_id} status={match.payment_status_p1} playerName={match.player1?.full_name || "P1"} openUpwards={isNearBottom} />
                                                    <span className="!text-gray-300" style={{ color: '#d1d5db' }}>{match.player1?.full_name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <PaymentStatusManager matchId={match.id} playerId={match.player2_id} status={match.payment_status_p2} playerName={match.player2?.full_name || "P2"} openUpwards={isNearBottom} />
                                                    <span className="!text-gray-300" style={{ color: '#d1d5db' }}>{match.player2?.full_name}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold
                                                ${effectiveStatus === 'finalized' ? 'bg-[#22c55e]/20 text-[#4ade80]' :
                                                    effectiveStatus === 'in_progress' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-surface text-gray-300'}`}>
                                                {effectiveStatus}
                                            </span>
                                        </td>
                                        <td className="p-2">
                                            <div className="flex items-center gap-2">
                                                {(effectiveStatus === 'in_progress' || effectiveStatus === 'finalized') && (
                                                    <div className="flex flex-col gap-1 items-end min-w-[60px]">
                                                        <span className="text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded text-gray-300 whitespace-nowrap flex items-center gap-2">
                                                            <span className="text-gray-500 mr-1">8B:</span>
                                                            <span className="text-white">{match.points_8ball_p1}-{match.points_8ball_p2}</span>
                                                            <ResetMatchButton matchId={match.id} gameType="8ball" isFinalized={match.status_8ball === 'finalized'} />
                                                        </span>
                                                        <span className="text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded text-gray-300 whitespace-nowrap flex items-center gap-2">
                                                            <span className="text-gray-500 mr-1">9B:</span>
                                                            <span className="text-white">{match.points_9ball_p1}-{match.points_9ball_p2}</span>
                                                            <ResetMatchButton matchId={match.id} gameType="9ball" isFinalized={match.status_9ball === 'finalized'} />
                                                        </span>
                                                    </div>
                                                )}
                                                {(leagueStatus === 'active' || leagueStatus === 'completed') && (
                                                    <Link href={`/dashboard/operator/leagues/${leagueId}/matches/${match.id}/score`} className="btn text-xs px-2 py-1 bg-surface border border-border hover:border-white !text-white hover:!text-white hover:bg-white/10 h-full flex items-center">
                                                        View
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {matches.map((match) => {
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
                            // Can deduce winner roughly by points although not perfect without game logic
                            // Visuals: just show who won if possible or Finalized
                            // For this MVP step, lets just show status
                            statusText = "FINALIZED";
                            statusColor = "text-[#4ade80]"; // Green
                        }

                        // Determine winner based on game status
                        // Ideally we'd have a winner field, but we can check points vs race
                        // Or just use the status text as requested in design "CORY WINS"
                        if (effectiveStatus === 'finalized') {
                            // Simple heuristic: Whoever has most total points? 
                            // Real logic depends on league rules (e.g. 8-ball + 9-ball aggregate?)
                            // VNEA is total points.
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
                            <div key={match.id} className="relative w-full aspect-[1.6/1] bg-black border-[3px] border-white p-4 flex flex-col justify-between">
                                {/* Top Section: Header */}
                                <div className="flex justify-between items-start text-center mb-2">
                                    {/* P1 Stats */}
                                    <div className="flex-1 flex flex-col items-center">
                                        <h3 className="text-[#D4AF37] font-bold text-sm sm:text-base leading-none mb-1 tracking-wide">{p1Name}</h3>
                                        <span className="text-white font-bold text-xs">{p1Rating.rating.toFixed(1)} ({p1Rating.confidence.toFixed(0)})</span>
                                    </div>

                                    {/* VS / Table */}
                                    <div className="flex flex-col items-center justify-start mx-2">
                                        <span className="text-[#D4AF37] text-xs font-bold mb-1">-VS-</span>
                                        <span className="text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{match.table_name || "TBD"}</span>
                                    </div>

                                    {/* P2 Stats */}
                                    <div className="flex-1 flex flex-col items-center">
                                        <h3 className="text-[#D4AF37] font-bold text-sm sm:text-base leading-none mb-1 tracking-wide">{p2Name}</h3>
                                        <span className="text-white font-bold text-xs">{p2Rating.rating.toFixed(1)} ({p2Rating.confidence.toFixed(0)})</span>
                                    </div>
                                </div>

                                {/* Divider Line */}
                                <div className="w-full h-[2px] bg-[#D4AF37] mb-3"></div>

                                {/* Games Section */}
                                <div className="flex-1 flex gap-4">
                                    {/* 8-Ball Box */}
                                    <div className="flex-1 flex flex-col">
                                        <h4 className="text-[#D4AF37] font-bold text-center mb-1 text-sm tracking-wider">8-BALL</h4>
                                        <div className="flex-1 border-[2px] border-white flex relative">
                                            {/* P1 Score */}
                                            <div className="flex-1 flex flex-col items-center justify-center border-r-[2px] border-white relative p-1">
                                                <div className="absolute top-1 text-center w-full">
                                                    <div className="text-[#D4AF37] font-bold text-xs leading-none">{p1Initial}</div>
                                                    <div className="text-white text-[8px] font-bold leading-none mt-[1px]">RACE TO {race8.p1}</div>
                                                </div>
                                                <div className="text-[#D4AF37] font-bold text-3xl mt-3">{match.points_8ball_p1 || 0}</div>
                                            </div>
                                            {/* P2 Score */}
                                            <div className="flex-1 flex flex-col items-center justify-center relative p-1">
                                                <div className="absolute top-1 text-center w-full">
                                                    <div className="text-[#D4AF37] font-bold text-xs leading-none">{p2Initial}</div>
                                                    <div className="text-white text-[8px] font-bold leading-none mt-[1px]">RACE TO {race8.p2}</div>
                                                </div>
                                                <div className="text-[#D4AF37] font-bold text-3xl mt-3">{match.points_8ball_p2 || 0}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 9-Ball Box */}
                                    <div className="flex-1 flex flex-col">
                                        <h4 className="text-[#D4AF37] font-bold text-center mb-1 text-sm tracking-wider">9-BALL</h4>
                                        <div className="flex-1 border-[2px] border-white flex relative">
                                            {/* P1 Score */}
                                            <div className="flex-1 flex flex-col items-center justify-center border-r-[2px] border-white relative p-1">
                                                <div className="absolute top-1 text-center w-full">
                                                    <div className="text-[#D4AF37] font-bold text-xs leading-none">{p1Initial}</div>
                                                    <div className="text-white text-[8px] font-bold leading-none mt-[1px]">RACE TO {race9.p1}</div>
                                                </div>
                                                <div className="text-[#D4AF37] font-bold text-3xl mt-3">{match.points_9ball_p1 || 0}</div>
                                            </div>
                                            {/* P2 Score */}
                                            <div className="flex-1 flex flex-col items-center justify-center relative p-1">
                                                <div className="absolute top-1 text-center w-full">
                                                    <div className="text-[#D4AF37] font-bold text-xs leading-none">{p2Initial}</div>
                                                    <div className="text-white text-[8px] font-bold leading-none mt-[1px]">RACE TO {race9.p2}</div>
                                                </div>
                                                <div className="text-[#D4AF37] font-bold text-3xl mt-3">{match.points_9ball_p2 || 0}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Status */}
                                <div className={`text-center font-bold tracking-widest text-sm mt-3 uppercase ${statusColor}`}>
                                    {statusText}
                                </div>

                                {/* Link Overlay (Full Card Click) */}
                                {(leagueStatus === 'active' || leagueStatus === 'completed') && (
                                    <Link href={`/dashboard/operator/leagues/${leagueId}/matches/${match.id}/score`} className="absolute inset-0 z-20 cursor-pointer" title="Go to Scoreboard"></Link>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
