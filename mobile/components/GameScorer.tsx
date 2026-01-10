import { View, Text, TouchableOpacity, Alert, Image } from "react-native";
import { useState, useRef, useEffect } from "react";

interface GameScorerProps {
    gameType: "8ball" | "9ball";
    player1: { id: string; name: string };
    player2: { id: string; name: string };
    gameNumber: number;
    onSubmit: (data: any) => void;
    isSubmitting: boolean;
    breakerId?: string | null;
    onUndoLastGame?: () => void;

    // 9-Ball Realtime Sync Props
    externalBallMapping?: Record<number, string | null>;
    onBallMappingChange?: (mapping: Record<number, string | null>) => void;

    // Deprecated but kept for interface compatibility if needed by parent (unused internally)
    onDragStart?: () => void;
    onDragEnd?: () => void;
    externalTurnId?: string | null;
    onTurnChange?: (newTurnId: string) => void;
}

// Simple Ball Component (Tap / Double Tap)
const SimpleBall = ({
    num,
    owner,
    onTap,
    onDoubleTap
}: {
    num: number;
    owner: string | null;
    onTap: (num: number) => void;
    onDoubleTap: (num: number) => void;
}) => {
    const lastTap = useRef<number>(0);
    const timerRef = useRef<any>(null);

    const handlePress = () => {
        const now = Date.now();
        const DOUBLE_PRESS_DELAY = 300;

        if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
            // Double Tap
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            onDoubleTap(num);
            lastTap.current = 0;
        } else {
            // Single Tap (Delay)
            lastTap.current = now;
            timerRef.current = setTimeout(() => {
                onTap(num);
                timerRef.current = null;
            }, DOUBLE_PRESS_DELAY);
        }
    };

    const BALL_IMAGES: Record<number, any> = {
        1: require('../assets/ball_1.png'), // Adjusted based on previous mappings or standard
        2: require('../assets/ball_2.png'),
        3: require('../assets/ball_3.png'),
        4: require('../assets/ball_4.png'),
        5: require('../assets/ball_5.png'),
        6: require('../assets/ball_6.png'),
        7: require('../assets/ball_7.png'),
        8: require('../assets/ball_8.png'),
        9: require('../assets/ball_9.png'),
    };
    // Note: If images are named non-standard (e.g. ball_1 is yellow/red mismatch), 
    // we use the require that matches the file system. 
    // Assuming standard naming 1-9. 

    const imageSource = BALL_IMAGES[num] || BALL_IMAGES[1];
    const sizeParam = owner ? "w-9 h-9" : "w-11 h-11";

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.8}
            className={`m-1 ${sizeParam} rounded-full justify-center items-center`}
            style={{
                shadowColor: "#000",
                shadowOffset: { width: 2, height: 3 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
                elevation: 5,
            }}
        >
            <View className="w-full h-full rounded-full overflow-hidden items-center justify-center bg-gray-900 border border-white/20">
                {owner !== 'dead' ? (
                    <Image
                        source={imageSource}
                        className="w-full h-full"
                        resizeMode="contain"
                    />
                ) : (
                    <View className="w-full h-full bg-black/50 items-center justify-center border-2 border-red-500 rounded-full">
                        <Text className="text-red-500 font-bold text-lg">X</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

export default function GameScorer({
    gameType,
    player1,
    player2,
    gameNumber,
    onSubmit,
    isSubmitting,
    breakerId,
    onUndoLastGame,
    externalBallMapping,
    onBallMappingChange
}: GameScorerProps) {

    // --- STATE ---

    // 8-Ball: Selected Winner for finalization
    const [stats, setStats] = useState({
        isBreakAndRun: false,
        isRackAndRun: false,
        isEarly8: false,
        is9OnSnap: false,
    });
    const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);

    // 9-Ball: Ball Assignments
    const [assigningPlayerId, setAssigningPlayerId] = useState<string>(player1.id);
    const [ballAssignments, setBallAssignments] = useState<Record<number, string | null>>({
        1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null
    });

    // UI State
    const [gameOverState, setGameOverState] = useState<'none' | 'selecting_outcome_8ball' | 'selecting_outcome_9ball'>('none');

    // --- EFFECTS ---

    // Sync external ball mapping (DB) -> Local State
    useEffect(() => {
        if (externalBallMapping && JSON.stringify(externalBallMapping) !== JSON.stringify(ballAssignments)) {
            setBallAssignments(externalBallMapping);
        }
    }, [externalBallMapping]);

    const updateBalls = (updater: (prev: Record<number, string | null>) => Record<number, string | null>) => {
        setBallAssignments(prev => {
            const next = updater(prev);
            if (onBallMappingChange && JSON.stringify(next) !== JSON.stringify(prev)) {
                onBallMappingChange(next);
            }
            return next;
        });
    };

    // Reset State when Game Number changes
    useEffect(() => {
        setStats({
            isBreakAndRun: false,
            isRackAndRun: false,
            isEarly8: false,
            is9OnSnap: false,
        });
        setBallAssignments({
            1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null
        });
        setGameOverState('none');
        setSelectedWinnerId(null);
        // Default assigning player to breaker or P1
        setAssigningPlayerId(breakerId || player1.id);
    }, [gameNumber]);

    // 9-Ball Game Over Watcher
    useEffect(() => {
        if (gameType === '9ball') {
            const nineBallOwner = ballAssignments[9];
            if (nineBallOwner && gameOverState === 'none') {
                setGameOverState('selecting_outcome_9ball');
            } else if (!nineBallOwner && gameOverState === 'selecting_outcome_9ball') {
                setGameOverState('none');
            }
        }
    }, [ballAssignments, gameType]);


    // --- HANDLERS ---

    const handleBallTap = (num: number) => {
        updateBalls(prev => {
            const owner = prev[num];
            // If already owned by assigning player, unassign. Else assign to assigning player.
            if (owner === assigningPlayerId) return { ...prev, [num]: null };
            return { ...prev, [num]: assigningPlayerId };
        });
    };

    const handleBallDoubleTap = (num: number) => {
        updateBalls(prev => {
            const owner = prev[num];
            if (owner === 'dead') return { ...prev, [num]: null };
            return { ...prev, [num]: 'dead' };
        });
    };

    const calculate9BallScore = () => {
        let p1Score = 0;
        let p2Score = 0;
        let calculatedWinner = null;
        Object.entries(ballAssignments).forEach(([numStr, owner]) => {
            const num = parseInt(numStr);
            const points = num === 9 ? 2 : 1;
            if (owner === player1.id) p1Score += points;
            if (owner === player2.id) p2Score += points;
            if (num === 9) {
                if (owner === player1.id) calculatedWinner = player1.id;
                if (owner === player2.id) calculatedWinner = player2.id;
            }
        });
        return { p1Score, p2Score, calculatedWinner };
    };

    // 8-BALL LOGIC
    const handle8BallWinnerSelect = (winnerId: string) => {
        setSelectedWinnerId(winnerId);
        setGameOverState('selecting_outcome_8ball');
    };

    const submit8BallGame = (outcomeType: 'std' | 'break_run' | 'rack_run' | 'early8' | 'scratch8') => {
        if (!selectedWinnerId) return;

        const statsUpdate = {
            isBreakAndRun: outcomeType === 'break_run',
            isRackAndRun: outcomeType === 'rack_run',
            isEarly8: outcomeType === 'early8' || outcomeType === 'scratch8',
            is9OnSnap: false,
            innings: 0
        };

        const p1Score = selectedWinnerId === player1.id ? 1 : 0;
        const p2Score = selectedWinnerId === player2.id ? 1 : 0;

        onSubmit({
            winnerId: selectedWinnerId,
            p1Score,
            p2Score,
            stats: statsUpdate
        });
    };

    const submit8BallEarlyWin = (loserId: string) => {
        // Loser scratched / early 8 -> Opponent wins
        const winnerId = loserId === player1.id ? player2.id : player1.id;

        const statsUpdate = {
            isBreakAndRun: false,
            isRackAndRun: false,
            isEarly8: true,
            is9OnSnap: false,
            innings: 0
        };

        const p1Score = winnerId === player1.id ? 1 : 0;
        const p2Score = winnerId === player2.id ? 1 : 0;

        onSubmit({
            winnerId,
            p1Score,
            p2Score,
            stats: statsUpdate
        });
    };

    // 9-BALL LOGIC
    const submit9BallGame = (outcome: 'std' | 'break_run' | '9_on_snap') => {
        const { p1Score, p2Score, calculatedWinner } = calculate9BallScore();

        // Safety check if 9 ball not assigned (should be caught by UI state)
        if (!calculatedWinner) {
            Alert.alert("Error", "9-Ball is not assigned.");
            return;
        }

        // 9-on-Snap logic: usually means instant win, score might need adjustment or just trust assignment?
        // If 9-on-Snap, we usually assume the person who made it cleared the rack or gets max points? 
        // For now, trust the calculated score from assignments. 
        // If 'win_zip', we trust assignment (opponent has 0).

        onSubmit({
            winnerId: calculatedWinner,
            p1Score,
            p2Score,
            stats: {
                isBreakAndRun: outcome === 'break_run',
                is9OnSnap: outcome === '9_on_snap',
                isRackAndRun: false,
                innings: 0
            },
            ballMapping: ballAssignments
        });
    };


    return (
        <View className="bg-background rounded-lg flex-1">
            <View className="p-4 bg-surface rounded-lg border border-border flex-1">

                {/* Header: Rack Number */}
                <Text className="text-primary text-center font-bold mb-4 uppercase tracking-wider text-sm">
                    {gameType === '8ball' ? `Rack ${gameNumber}` : `Game ${gameNumber}`}
                </Text>


                {/* 8-BALL UI */}
                {gameType === '8ball' && (
                    <View className="flex-1 justify-center">
                        {gameOverState === 'none' && (
                            <View className="gap-4">
                                <Text className="text-white text-center font-bold text-xl mb-4">WHO WON?</Text>
                                <TouchableOpacity
                                    onPress={() => handle8BallWinnerSelect(player1.id)}
                                    className="bg-primary p-6 rounded-lg border border-primary-foreground items-center"
                                >
                                    <Text className="text-black font-black text-xl uppercase">{player1.name}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handle8BallWinnerSelect(player2.id)}
                                    className="bg-gray-700 p-6 rounded-lg border border-gray-500 items-center"
                                >
                                    <Text className="text-white font-black text-xl uppercase">{player2.name}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {gameOverState === 'selecting_outcome_8ball' && selectedWinnerId && (
                            <View className="gap-3">
                                <Text className="text-primary text-center font-bold text-xl mb-2">
                                    {selectedWinnerId === player1.id ? player1.name : player2.name} WON
                                </Text>
                                <Text className="text-gray-400 text-center text-sm mb-4">HOW?</Text>

                                <TouchableOpacity onPress={() => submit8BallGame('std')} className="bg-gray-700 p-4 rounded-lg items-center mb-2">
                                    <Text className="text-white font-bold text-lg">MADE 8-BALL</Text>
                                </TouchableOpacity>

                                <View className="flex-row gap-3">
                                    <TouchableOpacity onPress={() => submit8BallGame('break_run')} className="flex-1 bg-blue-900/50 border border-blue-500 p-4 rounded-lg items-center mb-2">
                                        <Text className="text-blue-400 font-bold text-center">BREAK & RUN</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => submit8BallGame('rack_run')} className="flex-1 bg-purple-900/50 border border-purple-500 p-4 rounded-lg items-center mb-2">
                                        <Text className="text-purple-400 font-bold text-center">RACK & RUN</Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity onPress={() => submit8BallGame('early8')} className="bg-red-900/50 border border-red-700 p-4 rounded-lg items-center mb-2">
                                    <Text className="text-red-400 font-bold text-lg">OPPONENT EARLY 8</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => submit8BallGame('scratch8')} className="bg-red-900/50 border border-red-700 p-4 rounded-lg items-center mb-4">
                                    <Text className="text-red-400 font-bold text-lg">OPPONENT SCRATCH ON 8</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => setGameOverState('none')} className="items-center mt-2">
                                    <Text className="text-gray-500">Back</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}


                {/* 9-BALL UI */}
                {gameType === '9ball' && (
                    <View className="flex-1">
                        {/* Assigner Toggle */}
                        <View className="flex-row bg-black rounded-full mb-4 border border-gray-700 overflow-hidden">
                            <TouchableOpacity
                                onPress={() => setAssigningPlayerId(player1.id)}
                                className={`flex-1 p-3 items-center ${assigningPlayerId === player1.id ? 'bg-primary' : 'bg-transparent'}`}
                            >
                                <Text className={`font-bold ${assigningPlayerId === player1.id ? 'text-black' : 'text-gray-500'}`}>{player1.name}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setAssigningPlayerId(player2.id)}
                                className={`flex-1 p-3 items-center ${assigningPlayerId === player2.id ? 'bg-primary' : 'bg-transparent'}`}
                            >
                                <Text className={`font-bold ${assigningPlayerId === player2.id ? 'text-black' : 'text-gray-500'}`}>{player2.name}</Text>
                            </TouchableOpacity>
                        </View>
                        <Text className="text-gray-500 text-center text-[10px] uppercase mb-4">Tap ball to assign to selected player</Text>

                        {/* Ball Grid (All balls context) */}
                        <View className="flex-row flex-wrap justify-center gap-4 mb-8">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <SimpleBall
                                    key={num}
                                    num={num}
                                    owner={ballAssignments[num]}
                                    onTap={handleBallTap}
                                    onDoubleTap={handleBallDoubleTap}
                                />
                            ))}
                        </View>

                        {/* 9-Ball Outcome Selection */}
                        {gameOverState === 'selecting_outcome_9ball' && (
                            <View className="mt-auto">
                                <Text className="text-white text-center font-bold mb-2">9-BALL ASSIGNED</Text>

                                {/* Winner Logic for 9-Ball is implicit in ball assignment (who has 9), 
                                    but we can confirm outcome type */}

                                <TouchableOpacity onPress={() => submit9BallGame('std')} className="bg-primary p-3 rounded-lg items-center mb-2">
                                    <Text className="text-black font-bold">CONFIRM WIN</Text>
                                </TouchableOpacity>
                                <View className="flex-row gap-2">
                                    <TouchableOpacity onPress={() => submit9BallGame('break_run')} className="flex-1 bg-blue-900/50 border border-blue-500 p-3 rounded-lg items-center">
                                        <Text className="text-blue-400 font-bold text-xs">BREAK & RUN</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => submit9BallGame('9_on_snap')} className="flex-1 bg-yellow-900/50 border border-yellow-500 p-3 rounded-lg items-center">
                                        <Text className="text-yellow-400 font-bold text-xs">9 ON SNAP</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {gameNumber > 1 && !isSubmitting && (
                    <TouchableOpacity onPress={onUndoLastGame} className="mt-4 items-center self-center">
                        <Text className="text-red-500 text-xs underline">Undo Last Rack</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
