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
    const [selectedRace, setSelectedRace] = useState<'short' | 'long'>('short');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Determine available games
    // We now allow selecting finalized games to view them
    const is8BallAvailable = true;
    const is9BallAvailable = true;

    const handleStart = async () => {
        if (!selectedGame) return;
        setIsSubmitting(true);
        await startMatch(match.id, match.league_id, selectedRace, selectedGame);
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
                        <span className={styles.rating}>Rating: {match.player1.fargo_rating}</span>
                    </div>
                    <div className={styles.vs}>VS</div>
                    <div className={styles.player}>
                        <span className={styles.playerName}>{match.player2.full_name}</span>
                        <span className={styles.rating}>Rating: {match.player2.fargo_rating}</span>
                    </div>
                </div>

                <div className={styles.gameSelection}>
                    <h3>Select Game Type</h3>
                    <div className={styles.options}>
                        <button
                            className={`${styles.option} ${match.is_forfeit ? styles.disabled : ''}`}
                            onClick={() => !match.is_forfeit && handleGameClick('8ball')}
                            style={match.is_forfeit ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        >
                            <span className={styles.optionTitle}>8-Ball</span>
                            <span className={styles.status}>
                                {match.status_8ball === 'finalized' ?
                                    (match.winner_id_8ball ?
                                        `Winner: ${match.winner_id_8ball === match.player1_id ? match.player1.full_name : match.player2.full_name} (View)` :
                                        'Completed (View)') :
                                    match.status_8ball === 'in_progress' ? 'In Progress' : 'Start Match'}
                            </span>
                        </button>

                        <button
                            className={`${styles.option} ${match.is_forfeit ? styles.disabled : ''}`}
                            onClick={() => !match.is_forfeit && handleGameClick('9ball')}
                            style={match.is_forfeit ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        >
                            <span className={styles.optionTitle}>9-Ball</span>
                            <span className={styles.status}>
                                {match.status_9ball === 'finalized' ?
                                    (match.winner_id_9ball ?
                                        `Winner: ${match.winner_id_9ball === match.player1_id ? match.player1.full_name : match.player2.full_name} (View)` :
                                        'Completed (View)') :
                                    match.status_9ball === 'in_progress' ? 'In Progress' : 'Start Match'}
                            </span>
                        </button>
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

    // Race Selection for the selected game (Only if starting new)
    return (
        <div className={styles.container}>
            <button className={styles.backBtn} onClick={() => setSelectedGame(null)}>← Back</button>
            <h1>Start {selectedGame === '8ball' ? '8-Ball' : '9-Ball'} Match</h1>

            <div className={styles.raceSelection}>
                <h3>Select Race Format</h3>
                <div className={styles.options}>
                    <button
                        className={`${styles.option} ${selectedRace === 'short' ? styles.selected : ''}`}
                        onClick={() => setSelectedRace('short')}
                    >
                        <span className={styles.optionTitle}>Short Race</span>
                        <div className={styles.raceDetails}>
                            <span>{match.player1.full_name}: <strong>{races.short.p1}</strong></span>
                            <span>{match.player2.full_name}: <strong>{races.short.p2}</strong></span>
                        </div>
                    </button>

                    <button
                        className={`${styles.option} ${selectedRace === 'long' ? styles.selected : ''}`}
                        onClick={() => setSelectedRace('long')}
                    >
                        <span className={styles.optionTitle}>Long Race</span>
                        <div className={styles.raceDetails}>
                            <span>{match.player1.full_name}: <strong>{races.long.p1}</strong></span>
                            <span>{match.player2.full_name}: <strong>{races.long.p2}</strong></span>
                        </div>
                    </button>
                </div>
            </div>

            <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '2rem', fontSize: '1.2rem' }}
                onClick={handleStart}
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Starting...' : 'Start Match'}
            </button>
        </div>
    );
}
