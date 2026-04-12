'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import MatchDateManager from '@/components/MatchDateManager';
import PaymentStatusManager from '@/components/PaymentStatusManager';
import ResetMatchButton from '@/components/ResetMatchButton';
import ForfeitMatchButton from '@/components/ForfeitMatchButton';
import { isMatchDateLocked } from '@/utils/match-utils';

interface MatchesListViewProps {
    matches: any[];
    teamMatches?: any[];
    leagueId: string;
    leagueStatus: string;
    timezone: string;
    isTeamLeague?: boolean;
}

export default function MatchesListView({
    matches,
    teamMatches = [],
    leagueId,
    leagueStatus,
    timezone,
    isTeamLeague = false
}: MatchesListViewProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const hasMatches = isTeamLeague ? teamMatches.length > 0 : matches && matches.length > 0;
    const weekOptions = useMemo(() => {
        const sourceMatches = isTeamLeague ? teamMatches : matches;
        const weeks = new Set(
            (sourceMatches || [])
                .map((match) => Number(match.week_number))
                .filter((week) => Number.isFinite(week))
        );

        return Array.from(weeks).sort((a, b) => a - b);
    }, [isTeamLeague, matches, teamMatches]);

    const requestedWeek = searchParams.get('week');
    const parsedWeek = requestedWeek ? Number(requestedWeek) : NaN;
    const selectedWeek = weekOptions.includes(parsedWeek) ? parsedWeek : 'all';

    const setWeekFilter = (week: number | 'all') => {
        const params = new URLSearchParams(searchParams.toString());

        if (week === 'all') {
            params.delete('week');
        } else {
            params.set('week', String(week));
        }

        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    };

    const filteredMatches = useMemo(() => {
        if (selectedWeek === 'all') return matches;
        return matches.filter((match) => Number(match.week_number) === selectedWeek);
    }, [matches, selectedWeek]);

    const filteredTeamMatches = useMemo(() => {
        if (selectedWeek === 'all') return teamMatches;
        return teamMatches.filter((match) => Number(match.week_number) === selectedWeek);
    }, [teamMatches, selectedWeek]);

    const currentWeekCount = isTeamLeague ? filteredTeamMatches.length : filteredMatches.length;
    const tableModeHref = selectedWeek === 'all'
        ? `/dashboard/operator/leagues/${leagueId}/matches`
        : `/dashboard/operator/leagues/${leagueId}/matches?week=${selectedWeek}`;

    if (!hasMatches) {
        return (
            <div className="card-glass">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="console-section-title">Matches</h2>
                </div>
                <div className="text-center py-8 text-gray-500 italic">
                    No matches scheduled.
                </div>
            </div>
        );
    }

    return (
        <div className="card-glass">
            <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="console-section-title flex items-center gap-4">
                    Matches
                    {(isTeamLeague ? teamMatches.length : matches.length) > 0 && (
                        <span className="text-sm text-gray-400 font-normal">
                            ({currentWeekCount}
                            {selectedWeek === 'all' ? '' : ` of ${isTeamLeague ? teamMatches.length : matches.length}`})
                        </span>
                    )}
                </h2>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
                    {weekOptions.length > 1 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setWeekFilter('all')}
                                aria-pressed={selectedWeek === 'all'}
                                className={`inline-flex min-h-[34px] items-center justify-center whitespace-nowrap rounded-lg border px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-all ${
                                    selectedWeek === 'all'
                                        ? 'border-[#D4AF37] bg-[#D4AF37] text-black shadow-[0_0_0_1px_rgba(212,175,55,0.55),0_10px_24px_rgba(212,175,55,0.22)]'
                                        : 'border-white/20 bg-[#161616] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[#D4AF37]/55 hover:bg-[#1d1d1d]'
                                }`}
                            >
                                All Weeks
                            </button>
                            {weekOptions.map((week) => (
                                <button
                                    key={week}
                                    type="button"
                                    onClick={() => setWeekFilter(week)}
                                    aria-pressed={selectedWeek === week}
                                    className={`inline-flex min-h-[34px] items-center justify-center whitespace-nowrap rounded-lg border px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-all ${
                                        selectedWeek === week
                                            ? 'border-[#D4AF37] bg-[#D4AF37] text-black shadow-[0_0_0_1px_rgba(212,175,55,0.55),0_10px_24px_rgba(212,175,55,0.22)]'
                                            : 'border-white/20 bg-[#161616] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[#D4AF37]/55 hover:bg-[#1d1d1d]'
                                    }`}
                                >
                                    Week {week}
                                </button>
                            ))}
                        </div>
                    )}
                    <Link href={tableModeHref} className="btn btn-primary text-xs">
                        View Table Mode &rarr;
                    </Link>
                </div>
            </div>

            <div className="console-table-wrap">
                <table className="console-table">
                    <thead>
                        <tr>
                            <th>Wk</th>
                            {!isTeamLeague && <th>Date</th>}
                            <th>Matchup</th>
                            <th>Status</th>
                            <th>{isTeamLeague ? 'Team Score' : 'Scores'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isTeamLeague ? filteredTeamMatches.map((match) => {
                            return (
                                <tr key={match.id}>
                                    <td className="font-mono text-gray-400">{match.week_number}</td>
                                    <td>
                                        <div className="flex flex-col gap-1 text-sm">
                                            <span className="!text-white font-medium" style={{ color: '#ffffff' }}>{match.team_a?.name || 'Team A'}</span>
                                            <span className="!text-white font-medium" style={{ color: '#ffffff' }}>{match.team_b?.name || 'Team B'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold
                                            ${match.status === 'completed' ? 'bg-[#22c55e]/20 text-[#4ade80]' :
                                                match.status === 'in_progress' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-surface text-gray-300'}`}>
                                            {match.status}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded text-gray-300 whitespace-nowrap">
                                            <span className="text-white">{match.wins_a ?? 0}-{match.wins_b ?? 0}</span>
                                        </span>
                                    </td>
                                </tr>
                            );
                        }) : filteredMatches.map((match, index) => {
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
                                <tr key={match.id}>
                                    <td className="font-mono text-gray-400">{match.week_number}</td>
                                    <td className="text-sm">
                                        <MatchDateManager
                                            matchId={match.id}
                                            initialDate={match.scheduled_date}
                                            initialTime={match.scheduled_time}
                                            initialTable={match.table_name}
                                            isUnlocked={match.is_manually_unlocked}
                                            isDateLocked={isMatchDateLocked(match.scheduled_date, timezone || 'America/Chicago').locked}
                                        />
                                    </td>
                                    <td>
                                        <div className="flex flex-col gap-1 text-sm">
                                            <div className="flex items-center gap-2">
                                                <PaymentStatusManager matchId={match.id} playerId={match.player1_id} status={match.payment_status_p1} playerName={match.player1?.full_name || "P1"} openUpwards={isNearBottom} />
                                                <span className="!text-white font-medium" style={{ color: '#ffffff' }}>{match.player1?.full_name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <PaymentStatusManager matchId={match.id} playerId={match.player2_id} status={match.payment_status_p2} playerName={match.player2?.full_name || "P2"} openUpwards={isNearBottom} />
                                                <span className="!text-white font-medium" style={{ color: '#ffffff' }}>{match.player2?.full_name}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold
                                            ${effectiveStatus === 'finalized' ? 'bg-[#22c55e]/20 text-[#4ade80]' :
                                                effectiveStatus === 'in_progress' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-surface text-gray-300'}`}>
                                            {effectiveStatus}
                                        </span>
                                        <div className="mt-1">
                                            <ForfeitMatchButton 
                                                matchId={match.id} 
                                                leagueId={leagueId} 
                                                player1={{ id: match.player1_id, name: match.player1?.full_name || "P1" }}
                                                player2={{ id: match.player2_id, name: match.player2?.full_name || "P2" }}
                                                isFinalized={effectiveStatus === 'finalized'}
                                                isForfeit={match.is_forfeit}
                                            />
                                        </div>
                                    </td>
                                    <td>
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

                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {currentWeekCount === 0 && (
                <div className="py-6 text-center text-sm italic text-gray-500">
                    No matches scheduled for this week.
                </div>
            )}
        </div>
    );
}
