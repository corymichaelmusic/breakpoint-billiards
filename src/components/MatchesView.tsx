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
                        // This form action needs to be passed down or imported differently if we want to keep it
                        // For now we can keep the import if it's a server action, but we are in a client component.
                        // Server actions can be imported in client components.
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

                        // Determine match background
                        // Green felt for active/started? Gray for not started?
                        // Let's go with a pool table look for all, but maybe dim the not-started ones.
                        const isStarted = effectiveStatus === 'in_progress' || effectiveStatus === 'finalized';
                        const tableColor = isStarted ? 'bg-[#0a4d2e]' : 'bg-[#1a1a1a]';
                        const feltTexture = isStarted ? 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 100%)' : 'none';

                        // Get Ratings
                        const p1Rating = playerRatings[match.player1_id] || { rating: 500, confidence: 0 };
                        const p2Rating = playerRatings[match.player2_id] || { rating: 500, confidence: 0 };

                        // Calculate Races
                        const race8 = calculateRace(p1Rating.rating, p2Rating.rating, '8ball');
                        const race9 = calculateRace(p1Rating.rating, p2Rating.rating, '9ball');

                        return (
                            <div key={match.id} className={`${tableColor} border-8 border-[#3d2b1f] rounded-lg p-4 relative shadow-xl overflow-hidden`} style={{ backgroundImage: feltTexture }}>
                                {/* Pockets Visuals (Corners) */}
                                <div className="absolute top-0 left-0 w-8 h-8 bg-[#111] rounded-br-2xl border-r border-b border-[#222]"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 bg-[#111] rounded-bl-2xl border-l border-b border-[#222]"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 bg-[#111] rounded-tr-2xl border-r border-t border-[#222]"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 bg-[#111] rounded-tl-2xl border-l border-t border-[#222]"></div>

                                <div className="relative z-10 flex flex-col gap-4">
                                    {/* Header: Table Name & Status */}
                                    <div className="flex justify-between items-center bg-black/30 p-2 rounded">
                                        <h3 className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider">{match.table_name || 'Unassigned Table'}</h3>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${isStarted ? 'bg-black text-white' : 'bg-gray-700 text-gray-400'}`}>
                                            {effectiveStatus === 'in_progress' ? 'LIVE' : effectiveStatus}
                                        </span>
                                    </div>

                                    {/* Players Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Player 1 */}
                                        <div className="bg-black/40 p-3 rounded flex flex-col items-center text-center">
                                            <div className="font-bold text-white text-lg leading-tight mb-1">{match.player1?.full_name}</div>
                                            <div className="text-[10px] text-gray-400 font-mono mb-2 flex flex-col">
                                                <span>R: {p1Rating.rating}</span>
                                                <span>C: {p1Rating.confidence.toFixed(1)}</span>
                                            </div>

                                            {/* Score 8-Ball */}
                                            <div className="flex items-center justify-between w-full text-xs mb-1 px-2 border-b border-white/10 pb-1">
                                                <span className="text-gray-400">8-Ball</span>
                                                <span className="font-bold text-white text-lg">{match.points_8ball_p1} <span className="text-[10px] text-gray-500 font-normal">/ {race8.p1}</span></span>
                                            </div>
                                            {/* Score 9-Ball */}
                                            <div className="flex items-center justify-between w-full text-xs px-2">
                                                <span className="text-gray-400">9-Ball</span>
                                                <span className="font-bold text-white text-lg">{match.points_9ball_p1} <span className="text-[10px] text-gray-500 font-normal">/ {race9.p1}</span></span>
                                            </div>
                                        </div>

                                        {/* Player 2 */}
                                        <div className="bg-black/40 p-3 rounded flex flex-col items-center text-center">
                                            <div className="font-bold text-white text-lg leading-tight mb-1">{match.player2?.full_name}</div>
                                            <div className="text-[10px] text-gray-400 font-mono mb-2 flex flex-col">
                                                <span>R: {p2Rating.rating}</span>
                                                <span>C: {p2Rating.confidence.toFixed(1)}</span>
                                            </div>

                                            {/* Score 8-Ball */}
                                            <div className="flex items-center justify-between w-full text-xs mb-1 px-2 border-b border-white/10 pb-1">
                                                <span className="text-gray-400">8-Ball</span>
                                                <span className="font-bold text-white text-lg">{match.points_8ball_p2} <span className="text-[10px] text-gray-500 font-normal">/ {race8.p2}</span></span>
                                            </div>
                                            {/* Score 9-Ball */}
                                            <div className="flex items-center justify-between w-full text-xs px-2">
                                                <span className="text-gray-400">9-Ball</span>
                                                <span className="font-bold text-white text-lg">{match.points_9ball_p2} <span className="text-[10px] text-gray-500 font-normal">/ {race9.p2}</span></span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <div className="flex justify-center mt-2">
                                        {(leagueStatus === 'active' || leagueStatus === 'completed') && (
                                            <Link href={`/dashboard/operator/leagues/${leagueId}/matches/${match.id}/score`} className="btn bg-[#D4AF37] hover:bg-yellow-500 text-black text-xs font-bold px-6 py-2 rounded-full shadow-lg hover:scale-105 transition-all">
                                                To Scoreboard &rarr;
                                            </Link>
                                        )}
                                    </div>

                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
