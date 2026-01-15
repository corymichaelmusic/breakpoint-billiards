'use client';

import { useState } from 'react';

interface Participant {
    guest_name?: string | null;
    player?: { full_name: string } | null;
}

interface Match {
    id: string;
    round_label: string;
    match_position_code: string;
    status: string;
    table_assigned: string | null;
    score1: number;
    score2: number;
    player1?: Participant;
    player2?: Participant;
}

interface TournamentBracketProps {
    matches: Match[];
    onMatchClick: (match: Match) => void;
}

export default function TournamentBracket({ matches, onMatchClick }: TournamentBracketProps) {
    // 1. Group matches by Bracket Side (Winners vs Losers)
    const winnersMatches = matches.filter(m => m.match_position_code.startsWith('WR') || m.match_position_code.startsWith('F'));
    const losersMatches = matches.filter(m => m.match_position_code.startsWith('LR'));

    // 2. Group by Round within sides
    const groupMatchesByRound = (matches: Match[]) => {
        const rounds: { [key: string]: Match[] } = {};
        matches.forEach(m => {
            if (!rounds[m.round_label]) rounds[m.round_label] = [];
            rounds[m.round_label].push(m);
        });
        return Object.entries(rounds).sort((a, b) => {
            const numA = parseInt(a[0].match(/\d+/)?.[0] || '0');
            const numB = parseInt(b[0].match(/\d+/)?.[0] || '0');
            return numA - numB;
        });
    };

    const winnersRounds = groupMatchesByRound(winnersMatches);
    const losersRounds = groupMatchesByRound(losersMatches);

    // Chunk matches into pairs for bracket rendering
    const chunkMatches = (matches: Match[]) => {
        const pairs = [];
        for (let i = 0; i < matches.length; i += 2) {
            pairs.push(matches.slice(i, i + 2));
        }
        return pairs;
    };

    const getPlaceholder = (matchCode: string, slot: 1 | 2): string => {
        const parts = matchCode.match(/([WL])R(\d+)-(\d+)/);
        if (!parts) return 'TBD';
        const [_, side, roundStr, matchNumStr] = parts;
        const matchNum = parseInt(matchNumStr);

        if (side === 'W') {
            const sourceMatch = slot === 1 ? (matchNum * 2 - 1) : (matchNum * 2);
            return `Winner of W${roundStr}-${sourceMatch}`;
        }
        return `Loser of...`;
    };

    const getDisplayName = (player?: Participant) => {
        if (!player) return null;
        return player.guest_name || player.player?.full_name || 'Unknown';
    };

    const MatchNode = ({ match, side }: { match: Match, side: 'winners' | 'losers' }) => {
        const isAssigned = !!match.table_assigned;
        const isCompleted = match.status === 'completed';

        return (
            <div className={`relative flex items-center ${side === 'winners' ? '' : ''}`}>
                {/* MATCH CARD */}
                <div
                    onClick={() => onMatchClick(match)}
                    className={`
                        w-64 border rounded-md p-0 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-md z-20 relative
                        ${isCompleted ? 'bg-surface border-green-900/50' : isAssigned ? 'bg-surface border-blue-500/50' : 'bg-surface border-white/10'}
                    `}
                >
                    {/* Header */}
                    <div className={`flex justify-between items-center px-2 py-1 ${isAssigned ? 'bg-blue-900/20' : 'bg-white/5'}`}>
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                            {match.match_position_code}
                        </span>
                        {isAssigned && !isCompleted && (
                            <span className="text-[10px] font-bold text-blue-400">
                                {match.table_assigned}
                            </span>
                        )}
                        {isCompleted && (
                            <span className="text-[10px] font-bold text-green-400">FINAL</span>
                        )}
                    </div>

                    {/* Players */}
                    <div className="flex flex-col">
                        <div className={`flex justify-between items-center px-3 py-2 border-b border-white/5 ${match.score1 > match.score2 && isCompleted ? 'bg-green-500/10' : ''}`}>
                            <span className={`text-sm truncate max-w-[150px] ${match.player1 ? 'font-bold' : 'text-gray-600 italic text-xs'}`} style={match.player1 ? { color: '#D4AF37' } : {}}>
                                {getDisplayName(match.player1) || getPlaceholder(match.match_position_code, 1)}
                            </span>
                            {match.player1 && <span className="font-mono text-sm font-bold text-gray-400">{match.score1}</span>}
                        </div>
                        <div className={`flex justify-between items-center px-3 py-2 ${match.score2 > match.score1 && isCompleted ? 'bg-green-500/10' : ''}`}>
                            <span className={`text-sm truncate max-w-[150px] ${match.player2 ? 'font-bold' : 'text-gray-600 italic text-xs'}`} style={match.player2 ? { color: '#D4AF37' } : {}}>
                                {getDisplayName(match.player2) || getPlaceholder(match.match_position_code, 2)}
                            </span>
                            {match.player2 && <span className="font-mono text-sm font-bold text-gray-400">{match.score2}</span>}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Unified View Layout
    return (
        <div className="w-full h-full overflow-auto bg-[#0a0a0a] relative">
            <div className="min-w-max min-h-full p-12 flex flex-col gap-12">

                {/* WINNERS BRACKET SECTION */}
                <div className="flex flex-col">
                    <h3 className="text-[#D4AF37] font-bold uppercase tracking-[0.2em] mb-8 text-xl px-4 border-l-4 border-[#D4AF37]">
                        Tournament Bracket
                    </h3>

                    <div className="flex flex-row gap-16">
                        {winnersRounds.map(([roundName, roundMatches], roundIndex) => {
                            const pairs = chunkMatches(roundMatches);

                            return (
                                <div key={roundName} className="flex flex-col justify-around gap-8 min-w-[260px]">
                                    <div className="text-center text-xs text-gray-500 uppercase font-bold tracking-wider mb-2 bg-white/5 py-1 rounded">
                                        {roundName}
                                    </div>
                                    <div className="flex flex-col justify-around h-full gap-8">
                                        {pairs.map((pair, idx) => (
                                            <div key={idx} className="flex flex-col justify-around relative">
                                                {pair.map(match => (
                                                    <div key={match.id} className="py-4 relative">
                                                        <MatchNode match={match} side="winners" />
                                                    </div>
                                                ))}

                                                {/* Connector bracket for the pair */}
                                                {pair.length === 2 && roundIndex < winnersRounds.length - 1 && (
                                                    <div className="absolute top-0 bottom-0 right-0 w-8 border-r-2 border-gray-600 rounded-r-none translate-x-8 z-0"
                                                        style={{ top: '25%', bottom: '25%' }}
                                                    />
                                                )}

                                                {/* Single Line extension for the output of the pair */}
                                                {pair.length === 2 && roundIndex < winnersRounds.length - 1 && (
                                                    <div className="absolute top-1/2 right-0 w-8 h-0.5 bg-gray-600 translate-x-16 z-0" />
                                                )}

                                                {/* Single Line extension for the match if it's a single (e.g. final or bye scenario) */}
                                                {pair.length === 1 && roundIndex < winnersRounds.length - 1 && (
                                                    <div className="absolute top-1/2 right-0 w-16 h-0.5 bg-gray-600 translate-x-16 z-0" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* LOSERS BRACKET SECTION */}
                {losersRounds.length > 0 && (
                    <div className="flex flex-col mt-12 pt-12 border-t border-gray-800">
                        <h3 className="text-red-500 font-bold uppercase tracking-[0.2em] mb-8 text-xl px-4 border-l-4 border-red-500">
                            Losers Bracket
                        </h3>
                        <div className="flex flex-row gap-16">
                            {losersRounds.map(([roundName, roundMatches]) => (
                                <div key={roundName} className="flex flex-col justify-around gap-8 min-w-[260px]">
                                    <div className="text-center text-xs text-gray-500 uppercase font-bold tracking-wider mb-2 bg-white/5 py-1 rounded">
                                        {roundName}
                                    </div>
                                    <div className="flex flex-col justify-around h-full gap-8">
                                        {roundMatches.map(match => (
                                            <div key={match.id} className="py-4 relative">
                                                <MatchNode match={match} side="losers" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
