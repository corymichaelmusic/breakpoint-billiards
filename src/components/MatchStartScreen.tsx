'use client';

import { useState } from 'react';
import Image from 'next/image';
import { startMatch } from '@/app/actions/match-start-actions';
import styles from './MatchStartScreen.module.css';

type Props = {
    match: any;
    races: any;
    onSelectGame: (gameType: '8ball' | '9ball') => void;
    backLink?: string;
    backText?: string;
};

export default function MatchStartScreen({ match, races, onSelectGame, backLink, backText }: Props) {
    const [selectedGame, setSelectedGame] = useState<'8ball' | '9ball' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Determine available games
    // We now allow selecting finalized games to view them
    const is8BallAvailable = true;
    const is9BallAvailable = true;

    const handleStart = async () => {
        if (!selectedGame) return;
        setIsSubmitting(true);
        await startMatch(match.id, match.league_id, selectedGame);
        // After starting, we tell the container to switch view
        onSelectGame(selectedGame);
    };

    const handleGameClick = (gameType: '8ball' | '9ball') => {
        const status = gameType === '8ball' ? match.status_8ball : match.status_9ball;

        if (status === 'finalized' || status === 'in_progress') {
            // Just view it
            onSelectGame(gameType);
        } else {
            // Setup to start
            setSelectedGame(gameType);
        }
    };

    if (!selectedGame) {
        return (
            <div className={styles.container}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <Image
                        src="/breakpoint-logo-large.png"
                        alt="Breakpoint Billiards"
                        width={150}
                        height={150}
                        style={{ objectFit: 'contain' }}
                    />
                </div>
                <p className={styles.subtitle}>Week {match.week_number}</p>

                <div className={styles.matchup}>
                    <div className={styles.player}>
                        <span className={styles.playerName}>{match.player1.full_name}</span>
                        <span className={styles.rating}>Rating: {match.player1.breakpoint_rating}</span>
                    </div>
                    <div className={styles.vs}>VS</div>
                    <div className={styles.player}>
                        <span className={styles.playerName}>{match.player2.full_name}</span>
                        <span className={styles.rating}>Rating: {match.player2.breakpoint_rating}</span>
                    </div>
                </div>

                <div className={styles.gameSelection}>
                    <h3>Select Game Type</h3>
                    <div className={styles.options}>
                        <div
                            className={`${styles.option} ${(match.is_forfeit || match.status_8ball === 'finalized') ? styles.disabled : ''}`}
                            onClick={() => !match.is_forfeit && match.status_8ball !== 'finalized' && handleGameClick('8ball')}
                            style={(match.is_forfeit || match.status_8ball === 'finalized') ? { opacity: 0.8, cursor: 'default' } : { cursor: 'pointer' }}
                        >
                            <span className={styles.optionTitle}>8-Ball</span>
                            <span className={styles.status}>
                                {match.status_8ball === 'finalized' || (match.points_8ball_p1 || 0) > 0 || (match.points_8ball_p2 || 0) > 0 ?
                                    (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                                                {match.points_8ball_p1 || 0} - {match.points_8ball_p2 || 0}
                                            </span>
                                            <span style={{ fontSize: '0.8em', opacity: 0.8 }}>
                                                {match.status_8ball === 'finalized' ? '(Final)' : '(In Progress)'}
                                            </span>
                                        </div>
                                    ) :
                                    match.status_8ball === 'in_progress' ? 'In Progress' : 'Start Match'}
                            </span>
                        </div>

                        <div
                            className={`${styles.option} ${(match.is_forfeit || match.status_9ball === 'finalized') ? styles.disabled : ''}`}
                            onClick={() => !match.is_forfeit && match.status_9ball !== 'finalized' && handleGameClick('9ball')}
                            style={(match.is_forfeit || match.status_9ball === 'finalized') ? { opacity: 0.8, cursor: 'default' } : { cursor: 'pointer' }}
                        >
                            <span className={styles.optionTitle}>9-Ball</span>
                            <span className={styles.status}>
                                {match.status_9ball === 'finalized' || (match.points_9ball_p1 || 0) > 0 || (match.points_9ball_p2 || 0) > 0 ?
                                    (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                                                {match.points_9ball_p1 || 0} - {match.points_9ball_p2 || 0}
                                            </span>
                                            <span style={{ fontSize: '0.8em', opacity: 0.8 }}>
                                                {match.status_9ball === 'finalized' ? '(Final)' : '(In Progress)'}
                                            </span>
                                        </div>
                                    ) :
                                    match.status_9ball === 'in_progress' ? 'In Progress' : 'Start Match'}
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: "2rem", textAlign: "center" }}>
                    <a href={backLink || `/dashboard/operator/leagues/${match.league_id}`} className="btn btn-secondary">
                        {backText || "Return to League"}
                    </a>
                </div>

                {
                    match.status === 'finalized' && match.is_forfeit && (
                        <div style={{ marginTop: '2rem', textAlign: 'center', padding: '1rem', border: '1px solid #dc3545', borderRadius: 'var(--radius)', backgroundColor: 'rgba(220, 53, 69, 0.1)' }}>
                            <h3 style={{ color: '#dc3545', marginBottom: '0.5rem' }}>Match Forfeited</h3>
                            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                Winner: {match.winner_id === match.player1_id ? match.player1.full_name : match.player2.full_name}
                            </p>
                            <p style={{ color: '#888' }}>
                                Forfeited by: {match.forfeited_by === match.player1_id ? match.player1.full_name : match.player2.full_name}
                            </p>
                        </div>
                    )
                }
            </div >
        );
    }

    // Race Confirmation for the selected game (Only if starting new)
    const raceToP1 = selectedGame === '8ball' ? races.race8.p1 : races.race9.p1;
    const raceToP2 = selectedGame === '8ball' ? races.race8.p2 : races.race9.p2;

    return (
        <div className={styles.container}>
            <button className={styles.backBtn} onClick={() => setSelectedGame(null)}>← Back</button>
            <h1>Start {selectedGame === '8ball' ? '8-Ball' : '9-Ball'} Match</h1>

            <div className={styles.raceSelection} style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                <h3>Race Target</h3>
                <div className={styles.raceDetails} style={{ justifyContent: 'center', gap: '2rem', fontSize: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '1rem', color: '#888' }}>{match.player1.full_name}</span>
                        <strong style={{ fontSize: '3rem', color: 'var(--yellow)' }}>{raceToP1}</strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1rem', color: '#666' }}>VS</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>To</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '1rem', color: '#888' }}>{match.player2.full_name}</span>
                        <strong style={{ fontSize: '3rem', color: 'var(--yellow)' }}>{raceToP2}</strong>
                    </div>
                </div>
                <p style={{ textAlign: 'center', color: '#666', marginTop: '1rem', fontSize: '0.9rem' }}>
                    Race targets are automatically calculated based on the BBRS {selectedGame === '8ball' ? '8-Ball' : '9-Ball'} Matrix.
                </p>
            </div>

            <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem', fontSize: '1.2rem' }}
                onClick={handleStart}
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Starting...' : 'Start Match'}
            </button>
        </div>
    );
}
