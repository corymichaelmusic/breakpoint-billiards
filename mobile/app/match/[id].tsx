import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, Image, Animated, ActivityIndicator, Modal, Platform } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import EightBallScorer from '../../components/EightBallScorer'; // 8-ball scorer
import NineBallScorer from '../../components/NineBallScorer'; // 9-ball scorer
import { supabase } from '../../lib/supabase';
import { applyRealtimeAuth } from '../../lib/realtimeAuth'; // Import singleton
import { fetchMatchRaces, getBreakpointLevel } from '../../utils/rating'; // Import race calc
import { useMatchBroadcast } from '../../hooks/useMatchBroadcast';

// Default initial rating (used for display only - calculations happen server-side)
const INITIAL_RATING = 500;

// Helper for rating display defaults
const getRating = (p: any) => {
    return p?.rating || INITIAL_RATING;
};

export default function MatchScreen() {
    const { id, returnToScore, activeType } = useLocalSearchParams();
    console.log(" [MatchScreen] Initial Params:", { id, returnToScore, activeType });
    const router = useRouter();
    const { userId, getToken } = useAuth();
    const [match, setMatch] = useState<any>(null);
    const [games, setGames] = useState<any[]>([]);
    const [races, setRaces] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [lastSynced, setLastSynced] = useState<string | null>(null);

    // Score Verification State
    const [setCompleted8ball, setSetCompleted8ball] = useState(false);
    const [setCompleted9ball, setSetCompleted9ball] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<'in_progress' | 'pending_verification' | 'verified' | 'disputed'>('in_progress');
    const [showSubmissionModal, setShowSubmissionModal] = useState(false);

    // Outcome Selection State (Custom Overlay)
    const [outcomePromptVisible, setOutcomePromptVisible] = useState(false);
    const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null);

    // Initialize state based on navigation params
    const initialViewMode = returnToScore === 'true' ? 'scoring' : 'selection';
    const initialGameType = (activeType === '9ball' || activeType === '8ball') ? activeType : '8ball';

    const [viewMode, setViewMode] = useState<'selection' | 'scoring'>(initialViewMode);
    const [activeGameType, setActiveGameType] = useState<'8ball' | '9ball'>(initialGameType as '8ball' | '9ball');


    // UseRef for games to access inside Realtime listeners without stale closures
    const gamesRef = useRef<any[]>([]);
    const isFetching = useRef(false);

    // Manual Refresh Handler
    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchMatchData();
    }, []);

    // Sync Ref with State
    useEffect(() => {
        gamesRef.current = games;
    }, [games]);

    const fetchMatchData = useCallback(async () => {
        if (isFetching.current) {
            console.log("Skipping fetch, one is already in progress.");
            return;
        }

        // Validate UUID
        if (!id || typeof id !== 'string' || id.length !== 36 || id.startsWith('user_')) {
            console.error(" [MatchScreen] Invalid Match ID detected:", id);
            setLoading(false);
            return;
        }

        isFetching.current = true;
        try {
            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: 'Bearer ' + token } : undefined;
            const supabaseAuthenticated = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            // Optimized Fetch (Standard Selects instead of RPC to avoid UUID cast errors)
            const { data: matchDataRaw, error: matchError } = await supabaseAuthenticated
                .from('matches')
                .select(`
                    *,
                    league:league_id (*, parent_league:parent_league_id(*)),
                    player1:player1_id (full_name, nickname, fargo_rating, breakpoint_rating, avatar_url),
                    player2:player2_id (full_name, nickname, fargo_rating, breakpoint_rating, avatar_url)
                `)
                .eq('id', id)
                .single();

            if (matchError) throw matchError;
            if (!matchDataRaw) throw new Error("Match not found");

            // Fetch Games - Only show games scored by THIS user (independent scoring)
            const { data: gamesData, error: gamesError } = await supabaseAuthenticated
                .from('games')
                .select('*')
                .eq('match_id', id)
                .eq('scored_by', userId)
                .order('game_number');

            if (gamesError) throw gamesError;

            // Fetch League Players for Racks Played
            // We need this for BBRS calculation
            const { data: lps, error: lpsError } = await supabaseAuthenticated
                .from('league_players')
                .select('player_id, breakpoint_racks_played')
                .eq('league_id', matchDataRaw.league_id)
                .in('player_id', [matchDataRaw.player1_id, matchDataRaw.player2_id]);

            const matchData = { ...matchDataRaw };
            const lp1 = lps?.find((lp: any) => lp.player_id === matchData.player1_id);
            const lp2 = lps?.find((lp: any) => lp.player_id === matchData.player2_id);

            // Enrich Player 1
            if (matchData.player1) {
                matchData.player1.id = matchData.player1_id; // Ensure ID is present
                matchData.player1.racks = lp1?.breakpoint_racks_played || 0;
                matchData.player1.rating = matchData.player1.fargo_rating || matchData.player1.breakpoint_rating || INITIAL_RATING;
            }

            // Enrich Player 2
            if (matchData.player2) {
                matchData.player2.id = matchData.player2_id; // Ensure ID is present
                matchData.player2.racks = lp2?.breakpoint_racks_played || 0;
                matchData.player2.rating = matchData.player2.fargo_rating || matchData.player2.breakpoint_rating || INITIAL_RATING;
            }

            setMatch(matchData);
            setGames(gamesData || []);
            setLastSynced(new Date().toLocaleTimeString());

            // Fetch Races
            const rData = await fetchMatchRaces([{
                id: matchData.id,
                p1Rating: matchData.player1.rating,
                p2Rating: matchData.player2.rating
            }]);
            if (rData && rData[matchData.id]) {
                setRaces(rData[matchData.id]);
            }


        } catch (error: any) {
            // Suppress network errors and expired tokens (transient)
            const msg = error?.message || '';
            const code = error?.code || '';
            if (
                msg.includes('Network request failed') ||
                msg.includes('Load failed') ||
                msg.includes('JWT expired') ||
                code === 'PGRST303'
            ) {
                console.log('Transient error during poll (ignored):', msg);
            } else {
                console.error('Error fetching match:', error);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
            isFetching.current = false;
        }
    }, [id, getToken]);

    useEffect(() => {
        fetchMatchData();
    }, [id]);

    // Auto-detect set completion from games data (persists across app restarts)
    useEffect(() => {
        if (!match || !games.length) return;

        const p1Rating = match.player1?.rating || 500;
        const p2Rating = match.player2?.rating || 500;
        const p1Id = match.player1?.id;
        const p2Id = match.player2?.id;

        if (!races) return;

        // Calculate races
        const race8ball = races.race8;
        const race9ball = races.race9;

        // Count wins per game type
        const games8ball = games.filter(g => g.game_type === '8ball');
        const games9ball = games.filter(g => g.game_type === '9ball');

        const p1_8wins = games8ball.filter(g => g.winner_id === p1Id).length;
        const p2_8wins = games8ball.filter(g => g.winner_id === p2Id).length;
        const p1_9wins = games9ball.filter(g => g.winner_id === p1Id).length;
        const p2_9wins = games9ball.filter(g => g.winner_id === p2Id).length;

        // Check if races are met (but not yet finalized on server)
        const is8ballRaceMet = (p1_8wins >= race8ball.p1 || p2_8wins >= race8ball.p2);
        const is9ballRaceMet = (p1_9wins >= race9ball.p1 || p2_9wins >= race9ball.p2);

        // Auto-set completion state (only if not already finalized on server)
        if (is8ballRaceMet && match.status_8ball !== 'finalized' && !setCompleted8ball) {
            setSetCompleted8ball(true);
        }
        if (is9ballRaceMet && match.status_9ball !== 'finalized' && !setCompleted9ball) {
            setSetCompleted9ball(true);
        }

        // Also detect verification status from match data
        if (match.verification_status) {
            setVerificationStatus(match.verification_status);
        }
    }, [match, games, races]);

    // Focus Effect to ensure data is fresh when returning to screen
    // Focus Effect merged into Poller below



    // PERIODIC POLLING (Safety Net)
    // Ensures sync even if Realtime events are missed or blocked
    // Runs ONLY when screen is focused to prevent lag on other screens
    const isFocused = useIsFocused();
    useEffect(() => {
        if (!isFocused || !id || submitting) return;

        console.log("Starting poller...");
        fetchMatchData(); // Immediate fetch on focus to ensure data is fresh

        const interval = setInterval(() => {
            // console.log("Auto-refreshing match data...");
            fetchMatchData();
        }, 10000); // Reduced to 10s to improve responsiveness when Realtime fails

        return () => {
            // console.log("Stopping poller...");
            clearInterval(interval);
        };
    }, [isFocused, id, submitting]);

    // REALTIME SUBSCRIPTION
    // REALTIME SUBSCRIPTION
    // REALTIME SUBSCRIPTION
    // REALTIME SUBSCRIPTION

    useMatchBroadcast(id as string, fetchMatchData);

    const handleSubmitGame = async (winnerId: string, outcome: string, opponentId: string) => {
        if (submitting || !match) return;
        setSubmitting(true);

        try {
            console.log("[handleSubmitGame] START", { winnerId, outcomes: outcome, activeGameType });
            const token = await getToken({ template: 'supabase' });
            // Refresh Realtime Auth (Keep alive)
            await applyRealtimeAuth(token);

            const authHeader = token ? { Authorization: 'Bearer ' + token } : undefined;
            const supabaseAuthenticated = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            // Insert Game (player scores independently, verified later)
            const gameData = {
                match_id: match.id,
                game_number: games.filter(g => g.game_type === activeGameType).length + 1,
                game_type: activeGameType,
                winner_id: winnerId,
                is_break_and_run: outcome === 'break_run',
                is_rack_and_run: outcome === 'rack_run',
                is_early_8: outcome === 'early_8',
                is_scratch_8: outcome === 'scratch_8',
                is_9_on_snap: outcome === '9_snap',
                scored_by: userId // Each player scores independently
            };

            const { data: insertedGame, error: insertError } = await supabaseAuthenticated
                .from('games')
                .insert(gameData)
                .select()
                .single();

            if (insertError) throw insertError;

            // NOTE: We no longer update match points in real-time.
            // Each player scores independently, and final scores are submitted during verification.
            // The UI calculates scores from local games.

            // --- SUCCESS CONFIRMATION ---
            // Update local state with the inserted game
            setGames((prev: any[]) => {
                // Deduplication check
                if (prev.find((g: any) => g.id === insertedGame.id)) return prev;
                return [...prev, insertedGame];
            });

        } catch (e: any) {
            console.error("Submit Game Error", e);
            Alert.alert("Error", `Failed to submit game: ${e?.message || JSON.stringify(e)}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyAndFinalize = async () => {
        // Calculate winner BEFORE showing alert so we can announce it
        const p1Id = match.player1.id;
        const p2Id = match.player2.id;
        const p1Name = match.player1.nickname || match.player1.full_name?.split(' ')[0] || 'Player 1';
        const p2Name = match.player2.nickname || match.player2.full_name?.split(' ')[0] || 'Player 2';

        // Filter games for current type
        const relevantGames = games.filter(g => g.game_type === activeGameType);
        const p1WonRacks = relevantGames.filter(g => g.winner_id === p1Id).length;
        const p2WonRacks = relevantGames.filter(g => g.winner_id === p2Id).length;

        // Determine Match Winner (Based on Race Target)
        // Determine Match Winner (Based on Race Target)
        if (!races) {
            Alert.alert("Error", "Race data not loaded.");
            return;
        }
        const race = activeGameType === '8ball' ? races.race8 : races.race9;

        let winnerId = p2Id; // Default fallback
        if (p1WonRacks >= race.p1) winnerId = p1Id;
        else if (p2WonRacks >= race.p2) winnerId = p2Id;
        else winnerId = p1WonRacks > p2WonRacks ? p1Id : p2Id;

        const winnerName = winnerId === p1Id ? p1Name : p2Name;
        const gameTypeLabel = activeGameType === '8ball' ? '8-Ball' : '9-Ball';
        const otherSetLabel = activeGameType === '8ball' ? '9-Ball' : '8-Ball';
        const isOtherSetComplete = activeGameType === '8ball' ? setCompleted9ball : setCompleted8ball;

        // Show Set Completion Alert
        Alert.alert(
            `${gameTypeLabel} Set Finished!`,
            `🏆 ${winnerName} wins the set!\n\nFinal Score: ${p1Name} ${p1WonRacks} - ${p2WonRacks} ${p2Name}`,
            Platform.OS === 'ios' ? [
                {
                    text: isOtherSetComplete ? "Submit Match" : `Play ${otherSetLabel}`,
                    onPress: () => {
                        // Mark this set as complete
                        if (activeGameType === '8ball') {
                            setSetCompleted8ball(true);
                        } else {
                            setSetCompleted9ball(true);
                        }

                        if (isOtherSetComplete) {
                            // Both sets complete - show submission modal
                            setShowSubmissionModal(true);
                        } else {
                            // Switch to the other game type DIRECTLY
                            setActiveGameType(activeGameType === '8ball' ? '9ball' : '8ball');
                            setViewMode('scoring'); // Ensure we stay in scoring view
                        }
                    }
                },
                {
                    text: "Match Hub",
                    style: "destructive",
                    onPress: () => {
                        // Mark this set as complete
                        if (activeGameType === '8ball') {
                            setSetCompleted8ball(true);
                        } else {
                            setSetCompleted9ball(true);
                        }

                        if (isOtherSetComplete) {
                            setShowSubmissionModal(true);
                        } else {
                            setViewMode('selection');
                        }
                    }
                },
                { text: "Cancel", style: "cancel" }
            ] : [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Match Hub",
                    style: "destructive",
                    onPress: () => {
                        // Mark this set as complete
                        if (activeGameType === '8ball') {
                            setSetCompleted8ball(true);
                        } else {
                            setSetCompleted9ball(true);
                        }

                        if (isOtherSetComplete) {
                            setShowSubmissionModal(true);
                        } else {
                            setViewMode('selection');
                        }
                    }
                },
                {
                    text: isOtherSetComplete ? "Submit Match" : `Play ${otherSetLabel}`,
                    onPress: () => {
                        // Mark this set as complete
                        if (activeGameType === '8ball') {
                            setSetCompleted8ball(true);
                        } else {
                            setSetCompleted9ball(true);
                        }

                        if (isOtherSetComplete) {
                            // Both sets complete - show submission modal
                            setShowSubmissionModal(true);
                        } else {
                            // Switch to the other game type DIRECTLY
                            setActiveGameType(activeGameType === '8ball' ? '9ball' : '8ball');
                            setViewMode('scoring'); // Ensure we stay in scoring view
                        }
                    }
                }
            ]
        );
    };

    // New: Submit both sets for verification
    const handleSubmitForVerification = async () => {
        if (submitting) return;
        setSubmitting(true);

        try {
            const p1Id = match.player1.id;
            const p2Id = match.player2.id;

            // Calculate stats for both game types
            const games8ball = games.filter(g => g.game_type === '8ball');
            const games9ball = games.filter(g => g.game_type === '9ball');

            const stats = {
                '8ball': {
                    p1_racks: games8ball.filter(g => g.winner_id === p1Id).length,
                    p2_racks: games8ball.filter(g => g.winner_id === p2Id).length,
                    p1_break_runs: games8ball.filter(g => g.winner_id === p1Id && g.is_break_and_run).length,
                    p2_break_runs: games8ball.filter(g => g.winner_id === p2Id && g.is_break_and_run).length,
                    p1_rack_runs: games8ball.filter(g => g.winner_id === p1Id && g.is_rack_and_run).length,
                    p2_rack_runs: games8ball.filter(g => g.winner_id === p2Id && g.is_rack_and_run).length,
                },
                '9ball': {
                    p1_racks: games9ball.filter(g => g.winner_id === p1Id).length,
                    p2_racks: games9ball.filter(g => g.winner_id === p2Id).length,
                    p1_break_runs: games9ball.filter(g => g.winner_id === p1Id && g.is_break_and_run).length,
                    p2_break_runs: games9ball.filter(g => g.winner_id === p2Id && g.is_break_and_run).length,
                    p1_snaps: games9ball.filter(g => g.winner_id === p1Id && g.is_9_on_snap).length,
                    p2_snaps: games9ball.filter(g => g.winner_id === p2Id && g.is_9_on_snap).length,
                }
            };

            const token = await getToken({ template: 'supabase' });
            await applyRealtimeAuth(token);

            const authHeader = token ? { Authorization: 'Bearer ' + token } : undefined;
            const supabaseAuthenticated = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            // Submit for verification
            const { data, error } = await supabaseAuthenticated.rpc('submit_match_for_verification', {
                p_match_id: id,
                p_player_id: userId,
                p_stats: stats
            });

            if (error) throw error;

            const result = data as { success: boolean; status?: string; message?: string; error?: string; opponent_submission?: any; your_submission?: any };

            // Handle RPC failure responses (success: false)
            if (!result.success) {
                Alert.alert("Error", result.error || "Failed to submit for verification");
                return;
            }

            if (result.status === 'verified') {
                Alert.alert("Match Verified! 🎉", result.message || "Both players agree!");
                setVerificationStatus('verified');
                setShowSubmissionModal(false);
                router.replace('/(tabs)');
            } else if (result.status === 'waiting_for_opponent') {
                Alert.alert("Scores Submitted", result.message);
                setVerificationStatus('pending_verification');
                setShowSubmissionModal(false);
                router.replace('/(tabs)');
            } else if (result.status === 'disputed') {
                Alert.alert(
                    "Score Mismatch",
                    "Your scores don't match your opponent's. Please review and resubmit.",
                    [
                        {
                            text: "Review Scores",
                            onPress: () => {
                                setVerificationStatus('disputed');
                                // Keep modal open so user can review
                            }
                        }
                    ]
                );
            }

        } catch (e: any) {
            console.error("Verification Error", e);
            Alert.alert("Error", `Failed to submit for verification: ${e.message}`);
        } finally {
            setSubmitting(false);
        }
    };


    const handleSelectGame = (type: '8ball' | '9ball') => {
        setActiveGameType(type);
        setViewMode('scoring');
    };

    const handleEditGame = (gameId: string) => {
        router.push(`/game/${gameId}`);
    };

    // Custom Overlay Handlers
    const handleRequestOutcome = (winnerId: string) => {
        setPendingWinnerId(winnerId);
        setOutcomePromptVisible(true);
    };

    const handleCommitOutcome = (outcome: string) => {
        if (!pendingWinnerId) return;

        // Calculate opponent ID
        const opponentId = pendingWinnerId === match.player1.id ? match.player2.id : match.player1.id;

        // Submit Game
        handleSubmitGame(pendingWinnerId, outcome, opponentId);

        // Reset Overlay
        setOutcomePromptVisible(false);
        setPendingWinnerId(null);
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator size="large" color="#EAB308" />
                <Text className="text-foreground mt-4">Loading Match...</Text>
            </SafeAreaView>
        );
    }

    if (!match) {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center p-6">
                <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
                <Text className="text-foreground text-xl font-bold mt-4 text-center">Failed to load match</Text>
                <Text className="text-gray-400 text-center mt-2 mb-6">The match could not be found or there was a network error.</Text>
                <TouchableOpacity onPress={onRefresh} className="bg-primary px-6 py-3 rounded-full">
                    <Text className="text-black font-bold">Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.replace('/(tabs)')} className="mt-4">
                    <Text className="text-primary">Return to Dashboard</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-black pt-6" edges={['left', 'right']}>
            {viewMode === 'selection' && (
                <View className="px-4 py-2 border-b border-border/10">
                    <TouchableOpacity onPress={() => router.replace('/(tabs)')} className="flex-row items-center">
                        <Ionicons name="arrow-back" size={24} color="#888" />
                        <Text className="text-foreground ml-2 font-bold" numberOfLines={1} adjustsFontSizeToFit>Back to Dashboard</Text>
                    </TouchableOpacity>
                </View>
            )}

            {
                viewMode === 'scoring' && (
                    <View className="px-4 py-1 border-b border-border/10">
                        <TouchableOpacity onPress={() => setViewMode('selection')} className="flex-row items-center">
                            <Ionicons name="arrow-back" size={24} color="#888" />
                            <Text className="text-foreground ml-2 font-bold" numberOfLines={1} adjustsFontSizeToFit>Back to Hub</Text>
                        </TouchableOpacity>
                    </View>
                )
            }

            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchMatchData} tintColor="#fff" />}
            >
                {/* ... viewMode === 'selection' content ... */}
                {viewMode === 'selection' && (
                    <View className="flex-1 mt-0">
                        {/* Header: CURRENTLY */}
                        <View className="items-center mb-4">
                            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 w-full text-center" numberOfLines={1} adjustsFontSizeToFit>CURRENTLY PLAYING</Text>

                            <View className="flex-row items-center justify-center w-full px-4 mb-2">
                                {/* Player 1 */}
                                <View className="items-center w-24">
                                    <View className="w-20 h-20 rounded-full border-2 border-yellow-400/80 mb-2 overflow-hidden bg-surface">
                                        {match.player1.avatar_url ? (
                                            <Image source={{ uri: match.player1.avatar_url }} className="w-full h-full" />
                                        ) : (
                                            <View className="items-center justify-center flex-1 bg-gray-800">
                                                <Text className="text-yellow-400 text-3xl font-bold">{match.player1.full_name?.charAt(0)}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-white font-bold text-sm text-center w-full mb-1" numberOfLines={1} adjustsFontSizeToFit>{match.player1.nickname || match.player1.full_name?.split(' ')[0]}</Text>
                                    <Text className="text-yellow-400 font-bold text-base text-center w-full" numberOfLines={1} adjustsFontSizeToFit>{match.player1.rating}</Text>
                                </View>

                                {/* VS */}
                                <View className="px-4 pb-6">
                                    <Text className="text-gray-500 font-black text-lg italic">VS</Text>
                                </View>

                                {/* Player 2 */}
                                <View className="items-center w-24">
                                    <View className="w-20 h-20 rounded-full border-2 border-yellow-400/80 mb-2 overflow-hidden bg-surface">
                                        {match.player2.avatar_url ? (
                                            <Image source={{ uri: match.player2.avatar_url }} className="w-full h-full" />
                                        ) : (
                                            <View className="items-center justify-center flex-1 bg-gray-800">
                                                <Text className="text-yellow-400 text-3xl font-bold">{match.player2.full_name?.charAt(0)}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-white font-bold text-sm text-center w-full mb-1" numberOfLines={1} adjustsFontSizeToFit>{match.player2.nickname || match.player2.full_name?.split(' ')[0]}</Text>
                                    <Text className="text-yellow-400 font-bold text-base text-center w-full" numberOfLines={1} adjustsFontSizeToFit>{match.player2.rating}</Text>
                                </View>
                            </View>

                            <View className="mt-4 items-center w-full px-4">
                                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1 w-full text-center" numberOfLines={1} adjustsFontSizeToFit>WEEK {match.week_number}</Text>
                                <Text className="text-center text-gray-300 font-bold text-xs uppercase tracking-wide w-full" numberOfLines={1} adjustsFontSizeToFit>
                                    {match.league?.parent_league?.name ? `${match.league.parent_league.name} - ` : ''}{match.league?.name || 'LEAGUE'}
                                </Text>
                            </View>
                        </View>



                        {/* Game Selection Cards */}
                        <View className="gap-4 px-2">
                            {/* 8-Ball Card */}
                            <TouchableOpacity
                                onPress={() => handleSelectGame('8ball')}
                                className="bg-black/40 border border-yellow-400/50 rounded-xl p-6 items-center justify-center h-40"
                            >
                                <Text className="text-yellow-400 font-black text-3xl italic tracking-tighter mb-2">8-BALL</Text>
                                <Text className="text-white font-bold text-2xl mb-4 w-full text-center" numberOfLines={1} adjustsFontSizeToFit>
                                    {games.filter(g => g.game_type === '8ball' && g.winner_id === match.player1.id).length}-{games.filter(g => g.game_type === '8ball' && g.winner_id === match.player2.id).length}
                                </Text>

                                {match.status_8ball === 'finalized' ? (
                                    <View className="bg-green-500 px-2 py-1.5 rounded-full w-4/5 items-center">
                                        <Text className="text-white text-[10px] font-bold uppercase w-full text-center" numberOfLines={1} adjustsFontSizeToFit>
                                            Winner: {(match.winner_id_8ball === match.player1.id) ? match.player1.nickname || match.player1.full_name?.split(' ')[0] : match.player2.nickname || match.player2.full_name?.split(' ')[0]}
                                        </Text>
                                    </View>
                                ) : setCompleted8ball ? (
                                    <View className="bg-blue-500 px-6 py-1.5 rounded-full">
                                        <Text className="text-white text-[10px] font-bold uppercase">✓ READY TO SUBMIT</Text>
                                    </View>
                                ) : (
                                    <View className="bg-indigo-500 px-6 py-1.5 rounded-full">
                                        <Text className="text-white text-[10px] font-bold uppercase">PLAY SET</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* 9-Ball Card */}
                            <TouchableOpacity
                                onPress={() => handleSelectGame('9ball')}
                                className="bg-black/40 border border-yellow-400/50 rounded-xl p-6 items-center justify-center h-40"
                            >
                                <Text className="text-yellow-400 font-black text-3xl italic tracking-tighter mb-2">9-BALL</Text>
                                <Text className="text-white font-bold text-2xl mb-4 w-full text-center" numberOfLines={1} adjustsFontSizeToFit>
                                    {games.filter(g => g.game_type === '9ball' && g.winner_id === match.player1.id).length}-{games.filter(g => g.game_type === '9ball' && g.winner_id === match.player2.id).length}
                                </Text>

                                {match.status_9ball === 'finalized' ? (
                                    <View className="bg-green-500 px-2 py-1.5 rounded-full w-4/5 items-center">
                                        <Text className="text-white text-[10px] font-bold uppercase w-full text-center" numberOfLines={1} adjustsFontSizeToFit>
                                            Winner: {(match.winner_id_9ball === match.player1.id) ? match.player1.nickname || match.player1.full_name?.split(' ')[0] : match.player2.nickname || match.player2.full_name?.split(' ')[0]}
                                        </Text>
                                    </View>
                                ) : setCompleted9ball ? (
                                    <View className="bg-blue-500 px-6 py-1.5 rounded-full">
                                        <Text className="text-white text-[10px] font-bold uppercase">✓ READY TO SUBMIT</Text>
                                    </View>
                                ) : (
                                    <View className="bg-indigo-500 px-6 py-1.5 rounded-full">
                                        <Text className="text-white text-[10px] font-bold uppercase">PLAY SET</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Submit Match Button - shown when both sets are locally complete */}
                            {(setCompleted8ball && setCompleted9ball) && (
                                <TouchableOpacity
                                    onPress={() => setShowSubmissionModal(true)}
                                    className="bg-primary border-2 border-yellow-300 rounded-xl p-6 items-center justify-center"
                                >
                                    <Text className="text-black font-black text-xl uppercase tracking-wider mb-1">Submit Match</Text>
                                    <Text className="text-black/70 text-sm">Both sets complete - ready for verification</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {viewMode === 'scoring' && (
                    <View>
                        {/* Remove Back to Hub from here */}

                        {/* Race Calculation Logic Lifted */}
                        {(() => {
                            // Calculate scores from local games (not synced match.points)
                            const relevantGames = games.filter(g => g.game_type === activeGameType);
                            const p1Score = relevantGames.filter(g => g.winner_id === match.player1.id).length;
                            const p2Score = relevantGames.filter(g => g.winner_id === match.player2.id).length;

                            if (!races) return <ActivityIndicator color="#EAB308" />;

                            const raceP1 = activeGameType === '8ball'
                                ? races.race8.p1
                                : races.race9.p1;
                            const raceP2 = activeGameType === '8ball'
                                ? races.race8.p2
                                : races.race9.p2;

                            const isRaceMet = (p1Score >= raceP1) || (p2Score >= raceP2);
                            const isFinalized = (activeGameType === '8ball' ? match.status_8ball : match.status_9ball) === 'finalized';
                            const showFinalizeUI = isRaceMet && !isFinalized;

                            // Helper to get display name
                            const getP1Name = () => match.player1.nickname || match.player1.full_name?.split(' ')[0] || 'Player 1';
                            const getP2Name = () => match.player2.nickname || match.player2.full_name?.split(' ')[0] || 'Player 2';

                            return (
                                <View>
                                    {/* Saving Indicator */}
                                    {submitting && (
                                        <View className="flex-row items-center justify-center p-2 mb-4 bg-yellow-900/40 rounded-lg border border-yellow-600/50">
                                            <ActivityIndicator size="small" color="#EAB308" className="mr-3" />
                                            <Text className="text-yellow-400 font-bold uppercase tracking-wider text-xs">Saving Outcome...</Text>
                                        </View>
                                    )}

                                    {activeGameType === '8ball' ? (
                                        <EightBallScorer
                                            matchId={match.id}
                                            player1={{ ...match.player1, name: getP1Name() }}
                                            player2={{ ...match.player2, name: getP2Name() }}
                                            games={games.filter(g => g.game_type === '8ball')}
                                            raceTo={{ p1: raceP1, p2: raceP2 }}
                                            onRequestOutcome={handleRequestOutcome}
                                            isSubmitting={submitting}
                                            onEditGame={handleEditGame}
                                            isRaceComplete={showFinalizeUI}
                                            isFinalized={isFinalized}
                                            onFinalize={handleVerifyAndFinalize}
                                        />
                                    ) : (
                                        <NineBallScorer
                                            matchId={match.id}
                                            player1={{ ...match.player1, name: getP1Name() }}
                                            player2={{ ...match.player2, name: getP2Name() }}
                                            games={games.filter(g => g.game_type === '9ball')}
                                            raceTo={{ p1: raceP1, p2: raceP2 }}
                                            onRequestOutcome={handleRequestOutcome}
                                            isSubmitting={submitting}
                                            onEditGame={handleEditGame}
                                            isRaceComplete={showFinalizeUI}
                                            isFinalized={isFinalized}
                                            onFinalize={handleVerifyAndFinalize}
                                        />
                                    )}
                                </View>
                            );
                        })()}
                    </View>
                )}
            </ScrollView>

            {/* Match Submission Modal */}
            <Modal
                visible={showSubmissionModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowSubmissionModal(false)}
            >
                <View className="flex-1 bg-black/90 justify-end">
                    <View className="bg-surface rounded-t-3xl p-6 border-t border-yellow-600/50 max-h-[85%]">
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Header */}
                            <View className="items-center mb-6">
                                <View className="w-12 h-1 bg-gray-600 rounded-full mb-4" />
                                <Text className="text-primary text-2xl font-black uppercase tracking-wider mb-2">Submit Match</Text>
                                <Text className="text-gray-400 text-center">Review your scores before submitting for verification</Text>
                            </View>

                            {/* 8-Ball Summary */}
                            <View className="bg-black/40 border border-yellow-600/30 rounded-xl p-4 mb-4">
                                <Text className="text-yellow-400 font-bold text-lg mb-3">8-Ball Set</Text>
                                <View className="flex-row justify-between items-center mb-3">
                                    <View className="items-center flex-1">
                                        <Text className="text-white font-bold">{match?.player1?.nickname || match?.player1?.full_name?.split(' ')[0]}</Text>
                                        <Text className="text-yellow-400 text-3xl font-black">
                                            {games.filter(g => g.game_type === '8ball' && g.winner_id === match?.player1?.id).length}
                                        </Text>
                                    </View>
                                    <Text className="text-gray-500 font-bold px-4">vs</Text>
                                    <View className="items-center flex-1">
                                        <Text className="text-white font-bold">{match?.player2?.nickname || match?.player2?.full_name?.split(' ')[0]}</Text>
                                        <Text className="text-yellow-400 text-3xl font-black">
                                            {games.filter(g => g.game_type === '8ball' && g.winner_id === match?.player2?.id).length}
                                        </Text>
                                    </View>
                                </View>
                                {/* 8-Ball Bonus Stats */}
                                <View className="flex-row justify-around border-t border-gray-700 pt-3">
                                    <View className="items-center">
                                        <Text className="text-gray-500 text-[10px] uppercase">Break Runs</Text>
                                        <Text className="text-white font-bold">
                                            {games.filter(g => g.game_type === '8ball' && g.winner_id === match?.player1?.id && g.is_break_and_run).length} - {games.filter(g => g.game_type === '8ball' && g.winner_id === match?.player2?.id && g.is_break_and_run).length}
                                        </Text>
                                    </View>
                                    <View className="items-center">
                                        <Text className="text-gray-500 text-[10px] uppercase">Rack Runs</Text>
                                        <Text className="text-white font-bold">
                                            {games.filter(g => g.game_type === '8ball' && g.winner_id === match?.player1?.id && g.is_rack_and_run).length} - {games.filter(g => g.game_type === '8ball' && g.winner_id === match?.player2?.id && g.is_rack_and_run).length}
                                        </Text>
                                    </View>
                                </View>
                                {(setCompleted8ball || match?.status_8ball === 'finalized') && (
                                    <View className="bg-green-900/30 rounded-full px-3 py-1 mt-3 self-center">
                                        <Text className="text-green-400 text-xs font-bold uppercase">✓ Complete</Text>
                                    </View>
                                )}
                            </View>

                            {/* 9-Ball Summary */}
                            <View className="bg-black/40 border border-yellow-600/30 rounded-xl p-4 mb-6">
                                <Text className="text-yellow-400 font-bold text-lg mb-3">9-Ball Set</Text>
                                <View className="flex-row justify-between items-center mb-3">
                                    <View className="items-center flex-1">
                                        <Text className="text-white font-bold">{match?.player1?.nickname || match?.player1?.full_name?.split(' ')[0]}</Text>
                                        <Text className="text-yellow-400 text-3xl font-black">
                                            {games.filter(g => g.game_type === '9ball' && g.winner_id === match?.player1?.id).length}
                                        </Text>
                                    </View>
                                    <Text className="text-gray-500 font-bold px-4">vs</Text>
                                    <View className="items-center flex-1">
                                        <Text className="text-white font-bold">{match?.player2?.nickname || match?.player2?.full_name?.split(' ')[0]}</Text>
                                        <Text className="text-yellow-400 text-3xl font-black">
                                            {games.filter(g => g.game_type === '9ball' && g.winner_id === match?.player2?.id).length}
                                        </Text>
                                    </View>
                                </View>
                                {/* 9-Ball Bonus Stats */}
                                <View className="flex-row justify-around border-t border-gray-700 pt-3">
                                    <View className="items-center">
                                        <Text className="text-gray-500 text-[10px] uppercase">Break Runs</Text>
                                        <Text className="text-white font-bold">
                                            {games.filter(g => g.game_type === '9ball' && g.winner_id === match?.player1?.id && g.is_break_and_run).length} - {games.filter(g => g.game_type === '9ball' && g.winner_id === match?.player2?.id && g.is_break_and_run).length}
                                        </Text>
                                    </View>
                                    <View className="items-center">
                                        <Text className="text-gray-500 text-[10px] uppercase">9 on Snap</Text>
                                        <Text className="text-white font-bold">
                                            {games.filter(g => g.game_type === '9ball' && g.winner_id === match?.player1?.id && g.is_9_on_snap).length} - {games.filter(g => g.game_type === '9ball' && g.winner_id === match?.player2?.id && g.is_9_on_snap).length}
                                        </Text>
                                    </View>
                                </View>
                                {(setCompleted9ball || match?.status_9ball === 'finalized') && (
                                    <View className="bg-green-900/30 rounded-full px-3 py-1 mt-3 self-center">
                                        <Text className="text-green-400 text-xs font-bold uppercase">✓ Complete</Text>
                                    </View>
                                )}
                            </View>

                            {/* Verification Info */}
                            <View className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4 mb-6">
                                <Text className="text-blue-400 font-bold mb-2">How Verification Works</Text>
                                <Text className="text-gray-300 text-sm leading-5">
                                    Both players must submit their scores. Once both submit, the system will verify the scores match. If there's a discrepancy, you'll be asked to review and correct.
                                </Text>
                            </View>

                            {/* Disputed Warning */}
                            {verificationStatus === 'disputed' && (
                                <View className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 mb-6">
                                    <Text className="text-red-400 font-bold mb-2">⚠️ Score Mismatch</Text>
                                    <Text className="text-gray-300 text-sm leading-5">
                                        Your scores don't match your opponent's submission. Please review the rack history and resubmit with corrections.
                                    </Text>
                                </View>
                            )}

                            {/* Submit Button */}
                            <TouchableOpacity
                                onPress={handleSubmitForVerification}
                                disabled={submitting}
                                className={`py-4 rounded-xl items-center mb-4 ${submitting ? 'bg-gray-700' : 'bg-primary'}`}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <Text className="text-black font-bold text-lg uppercase tracking-wider">Submit for Verification</Text>
                                )}
                            </TouchableOpacity>

                            {/* Cancel Button */}
                            <TouchableOpacity
                                onPress={() => {
                                    setShowSubmissionModal(false);
                                    setViewMode('selection');
                                }}
                                className="py-3 items-center"
                            >
                                <Text className="text-gray-400 font-bold">Review Scores</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Outcome Selection Overlay (Replaces Modal to fix Android White Bar) */}
            {outcomePromptVisible && (
                <View className="absolute inset-x-0 inset-y-0 z-50 justify-end">
                    {/* Backdrop - Tap to Dismiss */}
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setOutcomePromptVisible(false)}
                        className="absolute inset-0 bg-black/80"
                    />

                    {/* Content */}
                    <View className="bg-surface rounded-t-3xl p-6 border-t border-gray-700 w-full mb-0 pb-10">
                        <View className="items-center mb-6">
                            <View className="w-12 h-1 bg-gray-600 rounded-full mb-4" />
                            <Text className="text-white text-xl font-bold text-center w-full" numberOfLines={1} adjustsFontSizeToFit>
                                How did {pendingWinnerId === match.player1.id
                                    ? (match.player1.nickname || match.player1.full_name?.split(' ')[0])
                                    : (match.player2.nickname || match.player2.full_name?.split(' ')[0])} win?
                            </Text>
                        </View>

                        <View className="gap-3 mb-4">
                            {activeGameType === '8ball' ? (
                                <>
                                    {/* 8-BALL OUTCOMES */}
                                    <TouchableOpacity onPress={() => handleCommitOutcome('made_8')} className="bg-gray-700 p-4 rounded-xl flex-row items-center">
                                        <View className="w-8 h-8 rounded-full bg-black border border-gray-500 items-center justify-center mr-4">
                                            <Text className="text-white font-bold text-xs">8</Text>
                                        </View>
                                        <Text className="text-white font-bold text-lg flex-1" numberOfLines={1} adjustsFontSizeToFit>Made 8-Ball</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => handleCommitOutcome('break_run')} className="bg-yellow-600/20 border border-yellow-600 p-4 rounded-xl flex-row items-center">
                                        <Text className="text-yellow-500 font-bold text-lg ml-2 flex-1" numberOfLines={1} adjustsFontSizeToFit>Break & Run</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => handleCommitOutcome('rack_run')} className="bg-green-600/20 border border-green-600 p-4 rounded-xl flex-row items-center">
                                        <Text className="text-green-500 font-bold text-lg ml-2 flex-1" numberOfLines={1} adjustsFontSizeToFit>Rack & Run</Text>
                                    </TouchableOpacity>

                                    <Text className="text-gray-500 text-xs font-bold uppercase mt-2 mb-1">Opponent Fault</Text>

                                    <TouchableOpacity onPress={() => handleCommitOutcome('early_8')} className="bg-red-900/30 border border-red-900 p-4 rounded-xl flex-row items-center">
                                        <Text className="text-red-400 font-bold text-lg ml-2 flex-1" numberOfLines={1} adjustsFontSizeToFit>Opponent Made Early 8</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => handleCommitOutcome('scratch_8')} className="bg-red-900/30 border border-red-900 p-4 rounded-xl flex-row items-center">
                                        <Text className="text-red-400 font-bold text-lg ml-2 flex-1" numberOfLines={1} adjustsFontSizeToFit>Opponent Scratched on 8</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    {/* 9-BALL SPECIFIC OUTCOMES */}
                                    <TouchableOpacity onPress={() => handleCommitOutcome('made_9')} className="bg-gray-700 p-4 rounded-xl flex-row items-center">
                                        <View className="w-8 h-8 rounded-full bg-white border border-gray-300 items-center justify-center mr-4 overflow-hidden relative">
                                            <View className="absolute w-full h-4 bg-yellow-400 top-2" />
                                            <Text className="text-black font-bold text-xs z-10">9</Text>
                                        </View>
                                        <Text className="text-white font-bold text-lg flex-1" numberOfLines={1} adjustsFontSizeToFit>Made 9-Ball</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => handleCommitOutcome('9_snap')} className="bg-yellow-600/20 border border-yellow-600 p-4 rounded-xl flex-row items-center">
                                        <Text className="text-white font-bold text-lg ml-2 flex-1" numberOfLines={1} adjustsFontSizeToFit>9 on the Snap</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => handleCommitOutcome('break_run')} className="bg-green-600/20 border border-green-600 p-4 rounded-xl flex-row items-center">
                                        <Text className="text-green-500 font-bold text-lg ml-2 flex-1" numberOfLines={1} adjustsFontSizeToFit>Break & Run</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>

                        <TouchableOpacity onPress={() => setOutcomePromptVisible(false)} className="items-center p-4">
                            <Text className="text-gray-400 font-bold text-center w-full" numberOfLines={1} adjustsFontSizeToFit>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </SafeAreaView >
    );
}
