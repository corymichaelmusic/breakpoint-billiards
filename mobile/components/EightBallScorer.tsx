import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, ScrollView, Animated } from 'react-native';
import { router } from 'expo-router';

// Types
type Player = {
    id: string;
    name: string;
    rating?: number; // Breakpoint Rating
};

type EightBallScorerProps = {
    matchId: string;
    player1: Player;
    player2: Player;
    games: any[];
    raceTo: { p1: number; p2: number };
    onSubmitGame: (winnerId: string, outcome: string, opponentId: string) => void;
    isSubmitting: boolean;
    onEditGame?: (gameId: string) => void;
    isRaceComplete?: boolean;
    isFinalized?: boolean;
    p1Verified?: boolean;
    p2Verified?: boolean;
    onVerify?: () => void;
    userRole?: 'p1' | 'p2' | 'spectator';
};

export default function EightBallScorer({
    matchId,
    player1,
    player2,
    games,
    raceTo,
    onSubmitGame,
    isSubmitting,
    onEditGame,
    isRaceComplete,
    isFinalized,
    p1Verified,
    p2Verified,
    onVerify,
    userRole
}: EightBallScorerProps) {
    const [view, setView] = useState<'score'>('score');

    // Scoring State
    const [outcomeModalVisible, setOutcomeModalVisible] = useState(false);
    const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);

    // Derived State
    const p1Wins = games.filter(g => g.winner_id === player1.id).length;
    const p2Wins = games.filter(g => g.winner_id === player2.id).length;
    const currentRackNumber = games.length + 1;

    // Verification State Helpers
    const myVerification = userRole === 'p1' ? p1Verified : (userRole === 'p2' ? p2Verified : false);
    const oppVerification = userRole === 'p1' ? p2Verified : (userRole === 'p2' ? p1Verified : false);

    // --- Scoring Logic ---
    const handleSelectWinner = (winnerId: string) => {
        setSelectedWinnerId(winnerId);
        setOutcomeModalVisible(true);
    };

    const handleOutcomeSelect = (outcome: string) => {
        if (!selectedWinnerId) return;
        const opponentId = selectedWinnerId === player1.id ? player2.id : player1.id;

        // Pass to parent to handle DB & BBRS
        onSubmitGame(selectedWinnerId, outcome, opponentId);

        // Close and reset
        setOutcomeModalVisible(false);
        setSelectedWinnerId(null);
    };

    // --- Render Helpers ---

    return (
        <View className="w-full">
            {/* Header / Scoreboard */}
            <View className="bg-surface p-4 rounded-lg border border-border mb-6">
                <View className="flex-row justify-between items-center">
                    <View className="items-center flex-1">
                        <Text className="text-white font-bold text-lg text-center w-full" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{player1.name}</Text>
                        <Text className="text-primary text-5xl font-black w-full text-center" numberOfLines={1} adjustsFontSizeToFit>{p1Wins}</Text>
                        <Text className="text-gray-500 text-xs">Race to {raceTo.p1}</Text>
                    </View>
                    <View className="items-center px-2">
                        <View className="bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                            <Text className="text-gray-400 text-xs font-bold">RACK {currentRackNumber}</Text>
                        </View>
                    </View>
                    <View className="items-center flex-1">
                        <Text className="text-white font-bold text-lg text-center w-full" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{player2.name}</Text>
                        <Text className="text-primary text-5xl font-black w-full text-center" numberOfLines={1} adjustsFontSizeToFit>{p2Wins}</Text>
                        <Text className="text-gray-500 text-xs">Race to {raceTo.p2}</Text>
                    </View>
                </View>
            </View>

            {/* Winner Selection OR Finalize UI */}
            {isFinalized ? (
                <View className="mb-8 bg-surface p-6 rounded-lg border border-gray-600 items-center opacity-80">
                    <Text className="text-gray-400 text-2xl font-bold mb-2">FINALIZED</Text>
                    <Text className="text-white text-xs">No further edits allowed.</Text>
                </View>
            ) : isRaceComplete ? (
                <View className="mb-8 bg-surface p-6 rounded-lg border border-green-600 items-center">
                    <Text className="text-green-500 text-2xl font-bold mb-2 w-full text-center" numberOfLines={1} adjustsFontSizeToFit>SET FINISHED</Text>
                    <Text className="text-white text-lg font-bold mb-4 text-center">Winner: {p1Wins >= raceTo.p1 ? player1.name : player2.name}</Text>

                    {userRole === 'spectator' ? (
                        <Text className="text-gray-400 text-center italic">Waiting for players to verify...</Text>
                    ) : (
                        <View className="w-full">
                            {myVerification ? (
                                oppVerification ? (
                                    <View className="items-center">
                                        <Text className="text-green-400 font-bold mb-2">Verified!</Text>
                                        <Text className="text-white text-xs">Finalizing match...</Text>
                                    </View>
                                ) : (
                                    <View className="items-center">
                                        <Text className="text-yellow-500 font-bold mb-2">Waiting for Opponent...</Text>
                                        <Text className="text-gray-400 text-xs text-center">You have verified the score.</Text>
                                    </View>
                                )
                            ) : (
                                oppVerification ? (
                                    <TouchableOpacity
                                        onPress={onVerify}
                                        className="bg-green-500 px-8 py-4 rounded-full w-full items-center shadow-lg shadow-green-900/20"
                                    >
                                        <Text className="text-white font-black text-lg">OPPONENT VERIFIED. CONFIRM?</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        onPress={onVerify}
                                        className="bg-primary px-8 py-3 rounded-full w-full items-center"
                                    >
                                        <Text className="text-black font-bold text-center">VERIFY SCORE</Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    )}
                </View>
            ) : (
                <>
                    <Text className="text-center text-gray-400 font-bold mb-4 uppercase tracking-widest">Select Winner of Rack {currentRackNumber}</Text>

                    <View className="flex-row gap-4 mb-8">
                        <TouchableOpacity
                            onPress={() => handleSelectWinner(player1.id)}
                            className="flex-1 bg-surface border-2 border-primary/50 p-6 rounded-xl items-center active:bg-primary/10"
                        >
                            <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center mb-2 border border-primary">
                                <Text className="text-primary text-2xl font-bold">{player1.name.charAt(0)}</Text>
                            </View>
                            <Text className="text-white font-bold text-lg text-center w-full" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{player1.name.split(' ')[0]}</Text>
                            <Text className="text-primary text-xs font-bold mt-1 text-center w-full" numberOfLines={1} adjustsFontSizeToFit>SELECT WINNER</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleSelectWinner(player2.id)}
                            className="flex-1 bg-surface border-2 border-gray-500/50 p-6 rounded-xl items-center active:bg-gray-500/10"
                        >
                            <View className="w-16 h-16 rounded-full bg-gray-700 items-center justify-center mb-2 border border-gray-500">
                                <Text className="text-white text-2xl font-bold">{player2.name.charAt(0)}</Text>
                            </View>
                            <Text className="text-white font-bold text-lg text-center w-full" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{player2.name.split(' ')[0]}</Text>
                            <Text className="text-gray-400 text-xs font-bold mt-1 text-center w-full" numberOfLines={1} adjustsFontSizeToFit>SELECT WINNER</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {/* Game History List */}
            <View>
                <Text className="text-gray-500 text-xs font-bold uppercase mb-2 ml-1">Rack History</Text>
                {games.slice().reverse().map((game, index) => {
                    const isP1Winner = game.winner_id === player1.id;
                    const rackNum = games.length - index;

                    // Helper for badges
                    let methodText = "";
                    if (game.is_break_and_run) methodText = "Break & Run";
                    else if (game.is_rack_and_run) methodText = "Rack & Run";
                    else if (game.is_early_8) methodText = "Early 8";
                    else if (game.is_scratch_8) methodText = "Scratch on 8";
                    else methodText = "Made 8-Ball";

                    return (
                        <TouchableOpacity
                            key={game.id}
                            onPress={() => !isFinalized && onEditGame && onEditGame(game.id)}
                            disabled={isFinalized}
                            className="flex-row items-center bg-surface-hover p-3 rounded-lg mb-2 border border-border"
                        >
                            <View className="bg-gray-800 w-8 h-8 rounded-full items-center justify-center mr-3">
                                <Text className="text-gray-400 font-bold text-xs">{rackNum}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className={`font-bold text-base ${isP1Winner ? 'text-blue-400' : 'text-red-400'}`}>
                                    {isP1Winner ? player1.name : player2.name}
                                </Text>
                                <Text className="text-gray-500 text-xs">{methodText}</Text>
                            </View>
                            {onEditGame && !isFinalized && (
                                <View className="px-2 w-12 items-end">
                                    <Text className="text-gray-500 text-xs font-bold" numberOfLines={1} adjustsFontSizeToFit>EDIT</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>


            {/* Method Selection Modal */}
            <Modal
                transparent={true}
                visible={outcomeModalVisible}
                animationType="slide"
                onRequestClose={() => setOutcomeModalVisible(false)}
            >
                <View className="flex-1 bg-black/80 justify-end">
                    <View className="bg-surface rounded-t-3xl p-6 border-t border-gray-700">
                        <View className="items-center mb-6">
                            <View className="w-12 h-1 bg-gray-600 rounded-full mb-4" />
                            <Text className="text-white text-xl font-bold text-center w-full" numberOfLines={1} adjustsFontSizeToFit>
                                How did {selectedWinnerId === player1.id ? player1.name : player2.name} win?
                            </Text>
                        </View>

                        <View className="gap-3 mb-8">
                            {/* 8-BALL OUTCOMES */}
                            <TouchableOpacity onPress={() => handleOutcomeSelect('made_8')} className="bg-gray-700 p-4 rounded-xl flex-row items-center">
                                <View className="w-8 h-8 rounded-full bg-black border border-gray-500 items-center justify-center mr-4">
                                    <Text className="text-white font-bold text-xs">8</Text>
                                </View>
                                <Text className="text-white font-bold text-lg flex-1" numberOfLines={1} adjustsFontSizeToFit>Made 8-Ball</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleOutcomeSelect('break_run')} className="bg-yellow-600/20 border border-yellow-600 p-4 rounded-xl flex-row items-center">
                                <Text className="text-yellow-500 font-bold text-lg ml-2 flex-1" numberOfLines={1} adjustsFontSizeToFit>Break & Run</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleOutcomeSelect('rack_run')} className="bg-green-600/20 border border-green-600 p-4 rounded-xl flex-row items-center">
                                <Text className="text-green-500 font-bold text-lg ml-2 flex-1" numberOfLines={1} adjustsFontSizeToFit>Rack & Run</Text>
                            </TouchableOpacity>

                            <Text className="text-gray-500 text-xs font-bold uppercase mt-2 mb-1">Opponent Fault</Text>

                            <TouchableOpacity onPress={() => handleOutcomeSelect('early_8')} className="bg-red-900/30 border border-red-900 p-4 rounded-xl flex-row items-center">
                                <Text className="text-red-400 font-bold text-lg ml-2 flex-1" numberOfLines={1} adjustsFontSizeToFit>Opponent Made Early 8</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleOutcomeSelect('scratch_8')} className="bg-red-900/30 border border-red-900 p-4 rounded-xl flex-row items-center">
                                <Text className="text-red-400 font-bold text-lg ml-2 flex-1" numberOfLines={1} adjustsFontSizeToFit>Opponent Scratched on 8</Text>
                            </TouchableOpacity>

                        </View>

                        <TouchableOpacity onPress={() => setOutcomeModalVisible(false)} className="items-center p-4">
                            <Text className="text-gray-400 font-bold text-center w-full" numberOfLines={1} adjustsFontSizeToFit>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
