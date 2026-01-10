'use client';

import { useState, useEffect } from 'react';
import { startMatch, submitMatch, forfeitMatch } from '@/app/actions/game-actions';
import MatchStartScreen from '@/components/MatchStartScreen';
import GameScoring from '@/components/GameScoring';
import { useRouter } from 'next/navigation';

type Props = {
    match: any;
    games: any[];
    races: any;
    leagueId: string;
    readOnly?: boolean;
    backLink?: string;
    backText?: string;
    p1BreakpointRating?: number;
    p2BreakpointRating?: number;
    isLocked?: boolean;
    lockReason?: string;
};

export default function MatchScoringContainer({ match, games, races, leagueId, readOnly, backLink, backText, p1BreakpointRating, p2BreakpointRating, isLocked, lockReason }: Props) {
    const [viewingGame, setViewingGame] = useState<'8ball' | '9ball' | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isSubmittingMatch, setIsSubmittingMatch] = useState(false);
    const [showForfeitModal, setShowForfeitModal] = useState(false);
    const router = useRouter();

    // Timer Logic
    useEffect(() => {
        if (readOnly) return; // Don't start timer if readOnly (e.g. spectator)
        // Wait, startMatch should be called only by operator/players? 
        // Assuming this component is protected/used by authorized users. 
        // For simplicity, we try to start it on mount.

        const initMatch = async () => {
            if (!match.started_at && !isLocked) {
                await startMatch(match.id, leagueId);
            }
        };
        initMatch();
    }, [match.started_at, match.id, leagueId, isLocked, readOnly]);

    useEffect(() => {
        // If whole match submitted, use stored duration
        if (match.submitted_at && match.duration_seconds) {
            setElapsedTime(match.duration_seconds);
            return;
        }

        const calculateTime = () => {
            const now = new Date().getTime();
            let totalSeconds = 0;

            // 8-Ball Duration
            if (match.status_8ball === 'in_progress' && match.started_at_8ball) {
                totalSeconds += Math.floor((now - new Date(match.started_at_8ball).getTime()) / 1000);
            } else if (match.status_8ball === 'finalized' && match.started_at_8ball && match.ended_at_8ball) {
                totalSeconds += Math.floor((new Date(match.ended_at_8ball).getTime() - new Date(match.started_at_8ball).getTime()) / 1000);
            }

            // 9-Ball Duration
            if (match.status_9ball === 'in_progress' && match.started_at_9ball) {
                totalSeconds += Math.floor((now - new Date(match.started_at_9ball).getTime()) / 1000);
            } else if (match.status_9ball === 'finalized' && match.started_at_9ball && match.ended_at_9ball) {
                totalSeconds += Math.floor((new Date(match.ended_at_9ball).getTime() - new Date(match.started_at_9ball).getTime()) / 1000);
            }

            // Fallback for legacy games (roughly)
            if (totalSeconds === 0 && match.started_at && !match.started_at_8ball && !match.started_at_9ball) {
                totalSeconds = Math.floor((now - new Date(match.started_at).getTime()) / 1000);
            }

            setElapsedTime(totalSeconds > 0 ? totalSeconds : 0);
        };

        calculateTime(); // Initial call
        const interval = setInterval(calculateTime, 1000);

        return () => clearInterval(interval);
    }, [match.started_at, match.submitted_at, match.duration_seconds, match.status_8ball, match.status_9ball, match.started_at_8ball, match.ended_at_8ball, match.started_at_9ball, match.ended_at_9ball]);

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Auto-select in-progress game on load
    useEffect(() => {
        if (viewingGame) return; // Don't override if user selected logic
        if (match.status_8ball === 'in_progress') setViewingGame('8ball');
        else if (match.status_9ball === 'in_progress') setViewingGame('9ball');
    }, [match.status_8ball, match.status_9ball]);

    const handleSelectGame = (gameType: '8ball' | '9ball') => {
        setViewingGame(gameType);
    };

    const handleBack = () => {
        setViewingGame(null);
    };

    const handleSubmitMatch = async () => {
        if (!confirm("Are you sure you want to submit the match? This will permanently lock it.")) return;
        setIsSubmittingMatch(true);
        const result = await submitMatch(match.id, leagueId);
        setIsSubmittingMatch(false);
        if (result?.error) alert(result.error);
        else router.refresh();
    };

    const handleForfeit = async (forfeitedByPlayerId: string, opponentId: string) => {
        if (!confirm("Are you sure? This will record a loss for this player and finalize the match.")) return;
        setIsSubmittingMatch(true);
        const result = await forfeitMatch(match.id, leagueId, forfeitedByPlayerId, opponentId);
        setIsSubmittingMatch(false);
        setShowForfeitModal(false);
        if (result?.error) alert(result.error);
        else router.refresh();
    };

    const bothFinished = match.status_8ball === 'finalized' && match.status_9ball === 'finalized';

    if (viewingGame) {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button
                        onClick={handleBack}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        ← Back to Match
                    </button>
                    <div style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.1rem' }}>
                        {formatTime(elapsedTime)}
                    </div>
                </div>
                <GameScoring
                    match={match}
                    games={games}
                    gameType={viewingGame}
                    readOnly={readOnly}
                    p1BreakpointRating={p1BreakpointRating}
                    p2BreakpointRating={p2BreakpointRating}
                    onBack={handleBack}
                    isLocked={isLocked}
                    lockReason={lockReason}
                />
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.1rem', color: '#888' }}>
                    {match.started_at
                        ? new Date(match.started_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                        : match.scheduled_date
                            ? new Date(match.scheduled_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                            : 'Date TBD'
                    }
                </div>
            </div>

            <MatchStartScreen
                match={match}
                races={races}
                onSelectGame={handleSelectGame}
                backLink={backLink}
                backText={backText}
            />

            {!match.submitted_at && !readOnly && !isLocked && (
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>

                    <button
                        className="btn"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', backgroundColor: 'transparent', border: '1px solid #444', color: '#666', alignSelf: 'center' }}
                        onClick={() => setShowForfeitModal(true)}
                        disabled={isSubmittingMatch}
                    >
                        Forfeit Match
                    </button>
                </div>
            )}

            {showForfeitModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: 'var(--radius)', maxWidth: '400px', width: '100%' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--foreground)' }}>Forfeit Match</h3>
                        <p style={{ marginBottom: '1.5rem', color: '#888' }}>Select the player who is forfeiting:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleForfeit(match.player1_id, match.player2_id)}
                                style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', border: '1px solid #444' }}
                            >
                                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{match.player1.full_name}</span>
                                <span style={{ fontSize: '0.9rem', color: '#ff6b6b' }}>is Forfeiting</span>
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleForfeit(match.player2_id, match.player1_id)}
                                style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', border: '1px solid #444' }}
                            >
                                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{match.player2.full_name}</span>
                                <span style={{ fontSize: '0.9rem', color: '#ff6b6b' }}>is Forfeiting</span>
                            </button>
                        </div>
                        <button
                            style={{ marginTop: '1.5rem', width: '100%', padding: '0.5rem', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
                            onClick={() => setShowForfeitModal(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
