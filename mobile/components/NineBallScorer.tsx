import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, ScrollView, Animated } from 'react-native';
import { router } from 'expo-router';

// Types
type Player = {
    id: string;
    name: string;
    rating?: number; // Breakpoint Rating
};

type NineBallScorerProps = {
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
    onFinalize?: () => void;
};

export default function NineBallScorer({
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
    onFinalize
}: NineBallScorerProps) {
    const [view, setView] = useState<'score'>('score');

    // Scoring State
    const [outcomeModalVisible, setOutcomeModalVisible] = useState(false);
    const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);

    // Derived State
    const p1Wins = games.filter(g => g.winner_id === player1.id).length;
    const p2Wins = games.filter(g => g.winner_id === player2.id).length;
    const currentRackNumber = games.length + 1;




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
                        <Text className="text-white font-bold text-lg" numberOfLines={1}>{player1.name}</Text>
                        <Text className="text-primary text-5xl font-black">{p1Wins}</Text>
                        <Text className="text-gray-500 text-xs">Race to {raceTo.p1}</Text>
                    </View>
                    <View className="items-center px-2">
                        <View className="bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                            <Text className="text-gray-400 text-xs font-bold">RACK {currentRackNumber}</Text>
                        </View>
                    </View>
                    <View className="items-center flex-1">
                        <Text className="text-white font-bold text-lg" numberOfLines={1}>{player2.name}</Text>
                        <Text className="text-primary text-5xl font-black">{p2Wins}</Text>
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
                    <Text className="text-green-500 text-2xl font-bold mb-4">SET FINISHED</Text>
                    <Text className="text-white mb-4">Race reached. Verify and Finalize.</Text>
                    <TouchableOpacity
                        onPress={onFinalize}
                        className="bg-primary px-8 py-3 rounded-full"
                    >
                        <Text className="text-black font-bold">VERIFY & FINALIZE</Text>
                    </TouchableOpacity>
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
                            <Text className="text-white font-bold text-lg text-center">{player1.name.split(' ')[0]}</Text>
                            <Text className="text-primary text-xs font-bold mt-1">SELECT WINNER</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleSelectWinner(player2.id)}
                            className="flex-1 bg-surface border-2 border-gray-500/50 p-6 rounded-xl items-center active:bg-gray-500/10"
                        >
                            <View className="w-16 h-16 rounded-full bg-gray-700 items-center justify-center mb-2 border border-gray-500">
                                <Text className="text-white text-2xl font-bold">{player2.name.charAt(0)}</Text>
                            </View>
                            <Text className="text-white font-bold text-lg text-center">{player2.name.split(' ')[0]}</Text>
                            <Text className="text-gray-400 text-xs font-bold mt-1">SELECT WINNER</Text>
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
                    else if (game.is_9_on_snap) methodText = "9 on Snap";
                    else if (game.is_win_zip) methodText = "Win-zip";
                    else methodText = "Made 9-Ball";

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
                                <Text className={`font-bold text-base ${isP1Winner ? 'text-primary' : 'text-gray-400'}`}>
                                    {isP1Winner ? player1.name : player2.name}
                                </Text>
                                <Text className="text-gray-500 text-xs">{methodText}</Text>
                            </View>
                            {onEditGame && !isFinalized && (
                                <View className="px-2">
                                    <Text className="text-gray-500 text-xs font-bold">EDIT</Text>
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
                            <Text className="text-white text-xl font-bold">
                                How did {selectedWinnerId === player1.id ? player1.name : player2.name} win?
                            </Text>
                        </View>

                        <View className="gap-3 mb-8">
                            {/* 9-BALL SPECIFIC OUTCOMES */}
                            <TouchableOpacity onPress={() => handleOutcomeSelect('made_9')} className="bg-gray-700 p-4 rounded-xl flex-row items-center">
                                <View className="w-8 h-8 rounded-full bg-white border border-gray-300 items-center justify-center mr-4 overflow-hidden relative">
                                    <View className="absolute w-full h-4 bg-yellow-400 top-2" />
                                    <Text className="text-black font-bold text-xs z-10">9</Text>
                                </View>
                                <Text className="text-white font-bold text-lg">Made 9-Ball</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleOutcomeSelect('9_snap')} className="bg-yellow-600/20 border border-yellow-600 p-4 rounded-xl flex-row items-center">
                                <Text className="text-white font-bold text-lg ml-2">9 on the Snap</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleOutcomeSelect('break_run')} className="bg-green-600/20 border border-green-600 p-4 rounded-xl flex-row items-center">
                                <Text className="text-green-500 font-bold text-lg ml-2">Break & Run</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleOutcomeSelect('win_zip')} className="bg-blue-600/20 border border-blue-600 p-4 rounded-xl flex-row items-center">
                                <Text className="text-blue-500 font-bold text-lg ml-2">Win-zip</Text>
                            </TouchableOpacity>

                        </View>

                        <TouchableOpacity onPress={() => setOutcomeModalVisible(false)} className="items-center p-4">
                            <Text className="text-gray-400 font-bold">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
