'use client';

import { useState, useRef, useEffect } from 'react';
import { submitGameScore, updateGameScore } from '@/app/actions/game-actions';
import styles from './GameScoring.module.css';
import { useRouter } from 'next/navigation';

type Props = {
    match: any;
    games: any[];
    gameType: '8ball' | '9ball';
    readOnly?: boolean;
    p1BreakpointRating?: number;
    p2BreakpointRating?: number;
    onBack?: () => void;
    isLocked?: boolean;
    lockReason?: string;
};

// Types for ball assignment
type BallOwner = string | 'dead' | null;

export default function GameScoring({ match, games, gameType, readOnly, p1BreakpointRating, p2BreakpointRating, onBack, isLocked, lockReason }: Props) {
    const router = useRouter();
    const [winnerId, setWinnerId] = useState<string | null>(null);
    const [loserScore, setLoserScore] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Stats State
    const [statBreakRun, setStatBreakRun] = useState(false);
    const [statRackRun, setStatRackRun] = useState(false);
    const [statEarly8, setStatEarly8] = useState(false);
    const [stat8WrongPocket, setStat8WrongPocket] = useState(false);
    // 9-Ball Stats
    const [statWinZip, setStatWinZip] = useState(false);
    const [stat9OnSnap, setStat9OnSnap] = useState(false);

    // Use passed gameType
    const activeGameType = gameType;

    // Filter games for this type
    const currentGames = games.filter(g => g.game_type === activeGameType || (!g.game_type && activeGameType === '8ball'));

    // Get current scores/race
    const currentP1 = activeGameType === '8ball' ? match.points_8ball_p1 : match.points_9ball_p1;
    const currentP2 = activeGameType === '8ball' ? match.points_8ball_p2 : match.points_9ball_p2;
    const raceP1 = activeGameType === '8ball' ? match.race_8ball_p1 : match.race_9ball_p1;
    const raceP2 = activeGameType === '8ball' ? match.race_8ball_p2 : match.race_9ball_p2;

    // 9-Ball State
    const [ballAssignments, setBallAssignments] = useState<Record<number, BallOwner>>({
        1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null
    });

    const nextGameNumber = currentGames.length + 1;
    const p1Needs = (raceP1 || 0) - (currentP1 || 0);
    const p2Needs = (raceP2 || 0) - (currentP2 || 0);

    // Drag and Drop Logic
    const handleDragStart = (e: React.DragEvent, ballNum: number) => {
        if (readOnly || isLocked) return;
        e.dataTransfer.setData("ballNum", ballNum.toString());
    };

    const handleDrop = (e: React.DragEvent, targetOwner: string | null) => {
        if (readOnly || isLocked) return;
        const ballNumStr = e.dataTransfer.getData("ballNum");
        if (!ballNumStr) return;
        const ballNum = parseInt(ballNumStr);

        setBallAssignments(prev => ({
            ...prev,
            [ballNum]: targetOwner as BallOwner
        }));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleBallClick = (ballNumber: number) => {
        if (readOnly || isLocked) return;
        setBallAssignments(prev => {
            const currentOwner = prev[ballNumber];

            // If assigned to a player, unassign (return to table)
            if (currentOwner === match.player1_id || currentOwner === match.player2_id) {
                return { ...prev, [ballNumber]: null };
            }

            // Toggle Dead state if on table (null or dead)
            if (currentOwner === 'dead') {
                return { ...prev, [ballNumber]: null }; // Reset to unassigned
            } else {
                return { ...prev, [ballNumber]: 'dead' };
            }
        });
    };

    const calculate9BallScore = () => {
        const p1Balls = Object.entries(ballAssignments).filter(([_, owner]) => owner === match.player1_id);
        const p2Balls = Object.entries(ballAssignments).filter(([_, owner]) => owner === match.player2_id);

        const p1Has9 = ballAssignments[9] === match.player1_id;
        const p2Has9 = ballAssignments[9] === match.player2_id;

        // Points: 1 pt for balls 1-8, 2 pts for ball 9
        // Dead balls count for NO ONE.
        const calculatePoints = (balls: [string, BallOwner][], has9: boolean) => {
            let points = 0;
            balls.forEach(([numStr, _]) => {
                const num = parseInt(numStr);
                if (num === 9) points += 2;
                else points += 1;
            });
            return points;
        };

        const p1Score = calculatePoints(p1Balls, p1Has9);
        const p2Score = calculatePoints(p2Balls, p2Has9);

        if (p1Has9) {
            return { winner: match.player1_id, p1Score, p2Score };
        } else if (p2Has9) {
            return { winner: match.player2_id, p1Score, p2Score };
        }
        return { winner: null, p1Score: 0, p2Score: 0 };
    };

    const [editingGameId, setEditingGameId] = useState<string | null>(null);

    const handleEditGame = (game: any) => {
        if (readOnly || isLocked) return;
        setEditingGameId(game.id);

        // Populate Form
        setWinnerId(game.winner_id);

        if (game.winner_id === match.player1_id) {
            setLoserScore(game.score_p2);
        } else {
            setLoserScore(game.score_p1);
        }

        // Restore Ball Mapping if exists, otherwise reset or infer
        if (game.ball_mapping) {
            const mapping: any = {};
            Object.entries(game.ball_mapping).forEach(([k, v]) => {
                mapping[parseInt(k)] = v;
            });
            const fullMapping: any = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null, ...mapping };
            setBallAssignments(fullMapping);
        } else {
            setBallAssignments({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null });
        }

        if (activeGameType === '8ball') {
            setStatBreakRun(game.is_break_and_run || false);
            setStatRackRun(game.is_rack_and_run || false);
            setStatEarly8(game.is_early_8 || false);
            setStat8WrongPocket(game.is_8_wrong_pocket || false);
        } else {
            setStatBreakRun(game.is_break_and_run || false);
            setStatRackRun(game.is_rack_and_run || false);
            setStatWinZip(game.is_win_zip || false);
            setStat9OnSnap(game.is_9_on_snap || false);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingGameId(null);
        setWinnerId(null);
        setLoserScore(0);
        setStatBreakRun(false);
        setStatRackRun(false);
        setStatEarly8(false);
        setStat8WrongPocket(false);
        setStatWinZip(false);
        setStat9OnSnap(false);
        setBallAssignments({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null });
    };

    const handleSubmit = async () => {
        if (readOnly || isLocked) return;
        let finalWinnerId = winnerId;
        let finalP1Score = 0;
        let finalP2Score = 0;

        if (activeGameType === '9ball') {
            if (ballAssignments[9] !== match.player1_id && ballAssignments[9] !== match.player2_id) {
                alert("The 9-Ball must be assigned to a player to submit the game.");
                return;
            }

            const result = calculate9BallScore();
            if (!result.winner) return;
            finalWinnerId = result.winner;
            finalP1Score = result.p1Score;
            finalP2Score = result.p2Score;
        } else {
            if (!winnerId) return;
            finalWinnerId = winnerId;
            if (winnerId === match.player1_id) {
                finalP1Score = 10;
                finalP2Score = loserScore;
            } else {
                finalP1Score = loserScore;
                finalP2Score = 10;
            }
        }

        if (!finalWinnerId) return;

        setIsSubmitting(true);

        try {
            let finalBallMapping = { ...ballAssignments };
            if (activeGameType === '9ball') {
                Object.keys(finalBallMapping).forEach(key => {
                    const k = parseInt(key);
                    if (finalBallMapping[k] === null) {
                        finalBallMapping[k] = 'dead';
                    }
                });
            }

            const stats = activeGameType === '8ball' ? {
                isBreakAndRun: statBreakRun,
                isRackAndRun: statRackRun,
                isEarly8: statEarly8,
                is8WrongPocket: stat8WrongPocket
            } : {
                isBreakAndRun: statBreakRun,
                isRackAndRun: statRackRun,
                isWinZip: statWinZip,
                is9OnSnap: stat9OnSnap
            };

            let result;
            if (editingGameId) {
                result = await updateGameScore(
                    editingGameId,
                    match.id,
                    match.league_id,
                    finalWinnerId,
                    finalP1Score,
                    finalP2Score,
                    activeGameType,
                    stats,
                    finalBallMapping as unknown as Record<string, string | null>
                );
            } else {
                result = await submitGameScore(
                    match.id,
                    match.league_id,
                    nextGameNumber,
                    finalWinnerId,
                    finalP1Score,
                    finalP2Score,
                    activeGameType,
                    stats,
                    finalBallMapping as unknown as Record<string, string | null>
                );
            }

            if (result?.error) {
                alert(`Error submitting score: ${result.error}`);
                return;
            }

            router.refresh();

            if (editingGameId) {
                handleCancelEdit();
            } else {
                setWinnerId(null);
                setLoserScore(0);
                setStatBreakRun(false);
                setStatRackRun(false);
                setStatEarly8(false);
                setStat8WrongPocket(false);
                setStatWinZip(false);
                setStat9OnSnap(false);
                setBallAssignments({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null });
            }
        } catch (error) {
            console.error("Submission failed:", error);
            alert("An unexpected error occurred while submitting.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getBallStyle = (num: number, isMini = false) => {
        const colors: Record<number, string> = {
            1: '#FDD835', // Yellow
            2: '#1E88E5', // Blue
            3: '#E53935', // Red
            4: '#8E24AA', // Purple
            5: '#FB8C00', // Orange
            6: '#43A047', // Green
            7: '#5D4037', // Maroon
            8: '#212121', // Black
            9: '#FDD835', // Yellow (Stripe)
        };

        const color = colors[num] || '#e0e0e0';
        const isStripe = num > 8; // 9-ball is stripe in this set 1-9

        // Text color is ALWAYS black for this style (number sits on white circle)
        const textColor = '#000';

        const baseStyle: React.CSSProperties = {
            color: textColor,
            border: 'none',
            // Font adjustment for the white circle constraint
            fontSize: isMini ? '0.6rem' : '1.0rem',
        };

        // Layers: 
        // 1. Highlight (Top-Left Gloss)
        // 2. White Circle (Center)
        // 3. Shading Overlay (Inner Shadow)
        // 4. Base Pattern (Solid or Stripe)

        // 1. Highlight
        const highlight = `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 25%)`;

        // 2. White Circle for Number (Smaller & Less Intrusive)
        // Reduced size (32%) and slightly off-white/transparent to blend better
        const whiteCircle = `radial-gradient(circle at 50% 50%, rgba(245,245,245,0.9) 32%, transparent 33%)`;

        // 3. Shading/Base
        let basePattern = '';

        if (isMini) {
            // Simplified for mini
            baseStyle.border = '1px solid #aaa';
            baseStyle.boxShadow = 'none';
            if (isStripe && num === 9) {
                basePattern = `linear-gradient(to bottom, #fff 25%, ${color} 25%, ${color} 75%, #fff 75%)`;
            } else {
                basePattern = color;
            }
            // Mini balls: Keeping the white circle but tiny for consistency.
            baseStyle.background = `${whiteCircle}, ${basePattern}`;
            if (num === 8) baseStyle.background = `${whiteCircle}, #212121`;
        } else {
            // Full Size
            if (num === 8) {
                // 8 Ball Solid
                basePattern = `radial-gradient(circle at 40% 40%, #424242 0%, #000000 100%)`;
            } else if (isStripe && num === 9) {
                // Stripe
                // We need a radial shading OVER the stripe to make it look round
                const shading = `radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 110%)`;
                const stripe = `linear-gradient(to bottom, #ffffff 20%, ${color} 20%, ${color} 80%, #ffffff 80%)`;
                basePattern = `${shading}, ${stripe}`;
            } else {
                // Solid Color with Gradient
                basePattern = `radial-gradient(circle at 40% 40%, ${color} 0%, #000 120%)`;
            }

            // Compose layers
            baseStyle.background = `${highlight}, ${whiteCircle}, ${basePattern}`;

            // Add subtle outer drop shadow via CSS class, but we can add inner depth here if needed
            // The box-shadow in CSS handles the outer shadow/depth.
        }

        return baseStyle;
    };


    const current9BallResult = calculate9BallScore();
    const isFinalized = activeGameType === '8ball' ? match.status_8ball === 'finalized' : match.status_9ball === 'finalized';

    const editingGame = editingGameId ? currentGames.find(g => g.id === editingGameId) : null;
    const displayGameNumber = editingGame ? editingGame.game_number : nextGameNumber;

    return (
        <div className={styles.container}>
            {/* Header */}
            <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
                {activeGameType === '8ball' ? '8-Ball' : '9-Ball'} Scoring - Game {displayGameNumber}
            </h2>

            {/* Scoreboard */}
            <div className={styles.scoreboard}>
                <div className={styles.playerScore}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, match.player1_id)}
                    style={{ border: activeGameType === '9ball' ? '2px dashed #444' : 'none', padding: '1rem', borderRadius: '0.5rem' }}
                >
                    <span className={styles.name}>{match.player1.full_name}</span>
                    <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.5rem" }}>
                        Fargo: {match.player1.fargo_rating} • BP: {p1BreakpointRating || 'N/A'}
                    </div>
                    <div className={styles.points}>
                        <span className={styles.current}>{currentP1 || 0}</span>
                        <span className={styles.target}>/ {raceP1 || 0}</span>
                    </div>
                    <span className={styles.needs}>Needs {p1Needs > 0 ? p1Needs : 0}</span>
                    {activeGameType === '9ball' && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
                            {Object.entries(ballAssignments)
                                .filter(([_, owner]) => owner === match.player1_id)
                                .map(([num, _]) => (
                                    <span
                                        key={num}
                                        className={styles.miniBall}
                                        onClick={() => handleBallClick(parseInt(num))}
                                        style={{
                                            cursor: (!readOnly && !isLocked) ? 'pointer' : 'default',
                                            ...getBallStyle(parseInt(num), true)
                                        }}
                                        title="Tap to remove"
                                    >
                                        {num}
                                    </span>
                                ))}
                        </div>
                    )}
                </div>
                <div className={styles.vs}>VS</div>
                <div className={styles.playerScore}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, match.player2_id)}
                    style={{ border: activeGameType === '9ball' ? '2px dashed #444' : 'none', padding: '1rem', borderRadius: '0.5rem' }}
                >
                    <span className={styles.name}>{match.player2.full_name}</span>
                    <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.5rem" }}>
                        Fargo: {match.player2.fargo_rating} • BP: {p2BreakpointRating || 'N/A'}
                    </div>
                    <div className={styles.points}>
                        <span className={styles.current}>{currentP2 || 0}</span>
                        <span className={styles.target}>/ {raceP2 || 0}</span>
                    </div>
                    <span className={styles.needs}>Needs {p2Needs > 0 ? p2Needs : 0}</span>
                    {activeGameType === '9ball' && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
                            {Object.entries(ballAssignments)
                                .filter(([_, owner]) => owner === match.player2_id)
                                .map(([num, _]) => (
                                    <span
                                        key={num}
                                        className={styles.miniBall}
                                        onClick={() => handleBallClick(parseInt(num))}
                                        style={{
                                            cursor: (!readOnly && !isLocked) ? 'pointer' : 'default',
                                            ...getBallStyle(parseInt(num), true)
                                        }}
                                        title="Tap to remove"
                                    >
                                        {num}
                                    </span>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {isLocked && !isFinalized && (
                <div style={{ textAlign: 'center', padding: '1rem', background: '#fff3cd', color: '#856404', borderRadius: 'var(--radius)', marginBottom: '1rem', border: '1px solid #ffeeba' }}>
                    <h3>Match Locked</h3>
                    <p>{lockReason}</p>
                    <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Please contact your operator to reschedule or unlock.</p>
                </div>
            )}

            {isFinalized && (
                <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--card-bg)', borderRadius: 'var(--radius)', marginBottom: '1rem', border: '1px solid var(--primary)' }}>
                    <h3>Match Completed</h3>
                    {activeGameType === '8ball' && match.winner_id_8ball && (
                        <p style={{ color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            Winner: {match.winner_id_8ball === match.player1_id ? match.player1.full_name : match.player2.full_name}
                        </p>
                    )}
                    {activeGameType === '9ball' && match.winner_id_9ball && (
                        <p style={{ color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            Winner: {match.winner_id_9ball === match.player1_id ? match.player1.full_name : match.player2.full_name}
                        </p>
                    )}
                    <p>Final Score: {currentP1} - {currentP2}</p>
                    <div style={{ marginTop: '1rem' }}>
                        {onBack ? (
                            <button onClick={onBack} className="btn btn-primary">
                                Back to Match
                            </button>
                        ) : (
                            <a href={`/dashboard/operator/leagues/${match.league_id}`} className="btn btn-primary">
                                Return to League
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Game Input */}
            {(!isFinalized || editingGameId) && !readOnly && (!isLocked || (isLocked && editingGameId)) && (
                <div className={styles.inputCard} style={editingGameId ? { border: '2px solid var(--accent)', position: 'relative' } : {}}>
                    {editingGameId && (
                        <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--accent)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                            EDITING
                        </div>
                    )}
                    <h3>Game {displayGameNumber}</h3>
                    {activeGameType === '9ball' ? (
                        <div className={styles.nineBallContainer}>
                            <p className={styles.instruction}>Drag balls to player area to assign. Tap to mark Dead (X).</p>
                            <div className={styles.poolTable}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, null)}
                                style={{ minHeight: '150px', border: '2px solid #333', borderRadius: '0.5rem', padding: '1rem', background: '#1a1a1a', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                                    const owner = ballAssignments[num];
                                    if (owner !== null && owner !== 'dead') return null;

                                    let ballClass = styles.ballUnassigned;
                                    const style = owner === 'dead' ? {} : getBallStyle(num);
                                    if (owner === 'dead') ballClass = styles.ballDead;

                                    return (
                                        <button
                                            key={num}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, num)}
                                            className={`${styles.poolBall} ${ballClass} ${num === 9 ? styles.ball9 : ''}`}
                                            onClick={() => handleBallClick(num)}
                                            style={{ cursor: 'grab', position: 'relative', ...style }}
                                        >
                                            {num}
                                            {owner === 'dead' && <span style={{ position: 'absolute', color: 'red', fontSize: '1.5rem', fontWeight: 'bold' }}>X</span>}
                                        </button>
                                    );
                                })}
                            </div>

                            {current9BallResult.winner && (
                                <div className={styles.resultPreview}>
                                    <p>
                                        Winner: <strong>{current9BallResult.winner === match.player1_id ? match.player1.full_name : match.player2.full_name}</strong>
                                    </p>
                                    <p>
                                        Score: <strong>{current9BallResult.p1Score} - {current9BallResult.p2Score}</strong>
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className={styles.winnerSelection}>
                                <p>Who won?</p>
                                <div className={styles.buttons}>
                                    <button
                                        className={`${styles.playerBtn} ${winnerId === match.player1_id ? styles.selected : ''}`}
                                        onClick={() => setWinnerId(match.player1_id)}
                                    >
                                        {match.player1.full_name}
                                    </button>
                                    <button
                                        className={`${styles.playerBtn} ${winnerId === match.player2_id ? styles.selected : ''}`}
                                        onClick={() => setWinnerId(match.player2_id)}
                                    >
                                        {match.player2.full_name}
                                    </button>
                                </div>
                            </div>

                            {winnerId && (
                                <div className={styles.loserScore}>
                                    <p>Loser's Score (Balls made):</p>
                                    <div className={styles.ballButtons}>
                                        {[0, 1, 2, 3, 4, 5, 6, 7].map(score => (
                                            <button
                                                key={score}
                                                className={`${styles.ballBtn} ${loserScore === score ? styles.selectedBall : ''}`}
                                                onClick={() => setLoserScore(score)}
                                            >
                                                {score}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {(winnerId || (activeGameType === '9ball' && current9BallResult.winner)) && (
                        <div className={styles.statsContainer} style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius)' }}>
                            <h4 style={{ marginBottom: '0.5rem' }}>Game Stats</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={statBreakRun}
                                        onChange={(e) => {
                                            setStatBreakRun(e.target.checked);
                                            if (e.target.checked) setStatRackRun(false);
                                        }}
                                    />
                                    <span style={{ fontSize: '0.9rem' }}>Break & Run</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={statRackRun}
                                        onChange={(e) => {
                                            setStatRackRun(e.target.checked);
                                            if (e.target.checked) setStatBreakRun(false);
                                        }}
                                    />
                                    <span style={{ fontSize: '0.9rem' }}>Rack & Run</span>
                                </label>

                                {activeGameType === '8ball' ? (
                                    <>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={statEarly8}
                                                onChange={(e) => {
                                                    setStatEarly8(e.target.checked);
                                                    if (e.target.checked) setStat8WrongPocket(false);
                                                }}
                                            />
                                            <span style={{ fontSize: '0.9rem' }}>Early 8</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={stat8WrongPocket}
                                                onChange={(e) => {
                                                    setStat8WrongPocket(e.target.checked);
                                                    if (e.target.checked) setStatEarly8(false);
                                                }}
                                            />
                                            <span style={{ fontSize: '0.9rem' }}>8 Wrong Pocket</span>
                                        </label>
                                    </>
                                ) : (
                                    <>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={statWinZip}
                                                onChange={(e) => setStatWinZip(e.target.checked)}
                                            />
                                            <span style={{ fontSize: '0.9rem' }}>Win-Zip</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={stat9OnSnap}
                                                onChange={(e) => setStat9OnSnap(e.target.checked)}
                                            />
                                            <span style={{ fontSize: '0.9rem' }}>9 on the Snap</span>
                                        </label>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        {editingGameId && (
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                                onClick={handleCancelEdit}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            className="btn btn-primary"
                            style={{ flex: 1 }}
                            onClick={handleSubmit}
                            disabled={(activeGameType === '8ball' && !winnerId) || (activeGameType === '9ball' && !current9BallResult.winner && !editingGameId) || isSubmitting}
                        >
                            {isSubmitting ? (editingGameId ? 'Updating...' : 'Submitting...') : (editingGameId ? 'Update Game' : 'Submit Game')}
                        </button>
                    </div>
                </div>
            )}

            {/* Game History */}
            {currentGames.length > 0 && (
                <div className={styles.history}>
                    <h3>Game History</h3>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Game</th>
                                <th>{match.player1.full_name}</th>
                                <th>{match.player2.full_name}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentGames.map((g) => (
                                <tr
                                    key={g.id}
                                    onClick={() => handleEditGame(g)}
                                    style={{ cursor: !readOnly && !isLocked ? 'pointer' : 'default', backgroundColor: editingGameId === g.id ? 'var(--highlight)' : 'transparent' }}
                                    className={editingGameId === g.id ? styles.editingRow : ''}
                                >
                                    <td>
                                        Game {g.game_number} {editingGameId === g.id && '✎'}
                                        {activeGameType === '9ball' && (g.dead_balls_count > 0 || (g.ball_mapping && Object.values(g.ball_mapping).filter((v: any) => v === 'dead').length > 0)) && (
                                            <span style={{ fontSize: '0.75rem', color: '#ff6b6b', marginLeft: '0.5rem', border: '1px solid #ff6b6b', borderRadius: '4px', padding: '0 4px' }}>
                                                {g.dead_balls_count || Object.values(g.ball_mapping).filter((v: any) => v === 'dead').length} Dead
                                            </span>
                                        )}
                                    </td>
                                    <td className={g.winner_id === match.player1_id ? styles.win : ''}>{g.score_p1}</td>
                                    <td className={g.winner_id === match.player2_id ? styles.win : ''}>{g.score_p2}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
