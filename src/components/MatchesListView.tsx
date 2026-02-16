'use client';

import Link from 'next/link';
import MatchDateManager from '@/components/MatchDateManager';
import PaymentStatusManager from '@/components/PaymentStatusManager';
import ResetMatchButton from '@/components/ResetMatchButton';
import { isMatchDateLocked } from '@/utils/match-utils';

interface MatchesListViewProps {
    matches: any[];
    leagueId: string;
    leagueStatus: string;
    timezone: string;
}

export default function MatchesListView({ matches, leagueId, leagueStatus, timezone }: MatchesListViewProps) {
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
                    {matches.length > 0 && (
                        <span className="text-sm text-gray-400 font-normal">
                            ({matches.length})
                        </span>
                    )}
                </h2>
                <div className="flex items-center gap-2">
                    <Link href={`/dashboard/operator/leagues/${leagueId}/matches`} className="btn bg-white border border-white hover:bg-gray-200 text-xs px-3 py-1 font-bold rounded transition-colors text-black shadow-lg shadow-white/10">
                        View Table Mode &rarr;
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
        </div>
    );
}
