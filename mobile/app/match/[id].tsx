import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, Image, Animated, SafeAreaView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import EightBallScorer from '../../components/EightBallScorer'; // 8-ball scorer
import NineBallScorer from '../../components/NineBallScorer'; // 9-ball scorer
import { supabase } from '../../lib/supabase';
import { applyRealtimeAuth } from '../../lib/realtimeAuth'; // Import singleton
import * as BBRS from '../../utils/bbrs'; // Import BBRS logic
import { calculateRace, getBreakpointLevel } from '../../utils/rating'; // Import race calc
import { useMatchBroadcast } from '../../hooks/useMatchBroadcast';

// Helper for BBRS defaults/normalization
const getRating = (p: any, type: 'start' | 'current' = 'current') => {
    // Ideally we fetch from profile or league_player snapshot
    // If we have 'match.player1.rating' set in fetch, use it.
    return p?.rating || BBRS.BBRS_INITIAL_RATING;
};

export default function MatchScreen() {
    const { id, returnToScore, activeType } = useLocalSearchParams();
    const router = useRouter();
    const { userId, getToken } = useAuth();
    const [match, setMatch] = useState<any>(null);
    const [games, setGames] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [lastSynced, setLastSynced] = useState<string | null>(null);

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
        isFetching.current = true;
        try {
            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: 'Bearer ' + token } : undefined;
            const supabaseAuthenticated = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            // Fetch Match + Players
            const { data: matchData, error: matchError } = await supabaseAuthenticated
                .from('matches')
                .select(`
                    *,
                    player1:player1_id (id, full_name, nickname, avatar_url, breakpoint_rating, fargo_rating),
                    player2:player2_id (id, full_name, nickname, avatar_url, breakpoint_rating, fargo_rating),
                    league:league_id (
                        name,
                        parent_league:parent_league_id (name)
                    )
                `)
                .eq('id', id)
                .single();

            if (matchError) throw matchError;

            // Validation Guard
            if (!matchData?.player1 || !matchData?.player2) {
                console.error("Match data missing players", matchData);
                throw new Error("Match data is incomplete (missing players). Check your connection or match ID.");
            }

            // Fetch BBRS Ratings separately to avoid join issues
            // (Wait until we have matchData to query ratings)
            const playerIds = [matchData.player1.id, matchData.player2.id];
            const { data: ratingData, error: ratingError } = await supabaseAuthenticated
                .from('league_players')
                .select('player_id, breakpoint_rating, breakpoint_racks_played')
                .eq('league_id', matchData.league_id)
                .in('player_id', playerIds);

            // Attach Ratings to Player Objects
            const lp1 = ratingData?.find((lp: any) => lp.player_id === matchData.player1.id);
            const lp2 = ratingData?.find((lp: any) => lp.player_id === matchData.player2.id);

            // Stats from League Players (Racks Played etc)
            // Use local stats for racks if available, otherwise 0
            matchData.player1.racks = lp1?.breakpoint_racks_played || 0;
            matchData.player2.racks = lp2?.breakpoint_racks_played || 0;

            // Ensure rating is present from profile join
            // PRIORITY: Fargo Rating (User Request) > Breakpoint Rating > Default
            matchData.player1.rating = matchData.player1.fargo_rating || matchData.player1.breakpoint_rating || BBRS.BBRS_INITIAL_RATING;
            matchData.player2.rating = matchData.player2.fargo_rating || matchData.player2.breakpoint_rating || BBRS.BBRS_INITIAL_RATING;

            setMatch(matchData);

            // Fetch Games
            const { data: gamesData, error: gamesError } = await supabaseAuthenticated
                .from('games')
                .select('*')
                .eq('match_id', id)
                .order('game_number', { ascending: true });

            if (gamesError) throw gamesError;
            setGames(gamesData || []);
            setLastSynced(new Date().toLocaleTimeString());

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

            // 1. Calculate BBRS Metrics
            const isP1Win = winnerId === match.player1.id;
            const p1Rating = match.player1.rating;
            const p2Rating = match.player2.rating;

            const expectedP1 = BBRS.calculateExpectedWinProb(p1Rating, p2Rating);
            const expectedP2 = 1 - expectedP1;

            const k1 = BBRS.getBaseKFactor(match.player1.racks);
            const k2 = BBRS.getBaseKFactor(match.player2.racks);

            const actualP1 = isP1Win ? 1 : 0;
            const actualP2 = isP1Win ? 0 : 1;

            const deltaBaseP1 = BBRS.calculateBaseDelta(actualP1 as 0 | 1, expectedP1, k1);
            const deltaBaseP2 = BBRS.calculateBaseDelta(actualP2 as 0 | 1, expectedP2, k2);

            const scaleP1 = BBRS.calculateOpponentScaling(p1Rating, p2Rating);
            const scaleP2 = BBRS.calculateOpponentScaling(p2Rating, p1Rating);

            const deltaScaledP1 = deltaBaseP1 * scaleP1;
            const deltaScaledP2 = deltaBaseP2 * scaleP2;

            // 2. Insert Game
            const gameData = {
                match_id: match.id,
                game_number: games.length + 1,
                game_type: activeGameType,
                winner_id: winnerId,
                is_break_and_run: outcome === 'break_run',
                is_rack_and_run: outcome === 'rack_run',
                is_early_8: outcome === 'early_8',
                is_scratch_8: outcome === 'scratch_8',
                is_9_on_snap: outcome === '9_snap',
                is_win_zip: outcome === 'win_zip',
                bbrs_expected_win_prob: expectedP1,
                bbrs_player1_rating_start: p1Rating,
                bbrs_player2_rating_start: p2Rating,
                bbrs_delta_base: deltaBaseP1,
                bbrs_delta_scaled: deltaScaledP1
            };

            const { data: insertedGame, error: insertError } = await supabaseAuthenticated
                .from('games')
                .insert(gameData)
                .select()
                .single();

            if (insertError) throw insertError;

            // 3. Update Match Scores (DB)
            // Explicitly get current scores based on type
            const currentP1 = activeGameType === '8ball' ? (match.points_8ball_p1 || 0) : (match.points_9ball_p1 || 0);
            const currentP2 = activeGameType === '8ball' ? (match.points_8ball_p2 || 0) : (match.points_9ball_p2 || 0);
            const newScoreP1 = Number(currentP1) + (isP1Win ? 1 : 0);
            const newScoreP2 = Number(currentP2) + (isP1Win ? 0 : 1);

            // Perform Dynamic Race Calculation (Same as UI)
            const calcRaceP1 = activeGameType === '8ball'
                ? calculateRace(match.player1.rating, match.player2.rating).short.p1
                : calculateRace(match.player1.rating, match.player2.rating, '9ball').short.p1;
            const calcRaceP2 = activeGameType === '8ball'
                ? calculateRace(match.player1.rating, match.player2.rating).short.p2
                : calculateRace(match.player1.rating, match.player2.rating, '9ball').short.p2;

            const dbMatchPayload: any = {};
            if (activeGameType === '8ball') {
                dbMatchPayload.points_8ball_p1 = newScoreP1;
                dbMatchPayload.points_8ball_p2 = newScoreP2;

                // REMOVED: Premature auto-finalize. 
                // We rely on the UI to detect race completion and prompt user to "Verify & Finalize".

            } else {
                dbMatchPayload.points_9ball_p1 = newScoreP1;
                dbMatchPayload.points_9ball_p2 = newScoreP2;
            }

            // Global Status Check: If both sets are finalized (or just this one if single set match)
            // Ideally we check if *all* active sets are done. For now, we update global status if the current set updates.
            // A simplified rule: if this set updates to finalized, update global to finalized? 
            // Wait, we have separate statuses. Let's start with updating local status.
            // If the schema requires a global 'status', we should probably set it to finalized if *all* races are done.
            // But since this app seems to often be one type at a time, we can defer complex multi-set logic.
            // For now, if the current game type finalizes, we'll mark global status finalized just to trigger UI completion if needed,
            // or rely on the UI checking `status_8ball` / `status_9ball`. 
            // Let's stick to updating the specific status columns for now as that's safer.


            // Increment Racks Played for BBRS
            match.player1.racks += 1;
            match.player2.racks += 1;

            const { error: updateError } = await supabaseAuthenticated
                .from('matches')
                .update(dbMatchPayload)
                .eq('id', match.id);

            if (updateError) throw updateError;


            // --- SUCCESS CONFIRMATION ---
            // Update local state with the CONFIRMED data from DB
            setGames((prev: any[]) => {
                // Deduplication check in case Realtime beat us to it
                if (prev.find((g: any) => g.id === insertedGame.id)) return prev;
                return [...prev, insertedGame];
            });
            setMatch((prev: any) => ({ ...prev, ...dbMatchPayload }));

        } catch (e: any) {
            console.error("Submit Game Error", e);
            Alert.alert("Error", `Failed to submit game: ${e?.message || JSON.stringify(e)}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyAndFinalize = async () => {
        // Simple Set Verification Logic
        Alert.alert("Verify & Finalize", "Are both players agreed on the final score?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Yes, Finalize Set",
                onPress: async () => {
                    try {
                        const token = await getToken({ template: 'supabase' });
                        // Refresh Realtime Auth (Keep alive)
                        await applyRealtimeAuth(token);

                        const authHeader = token ? { Authorization: 'Bearer ' + token } : undefined;
                        const supabaseAuthenticated = createClient(
                            process.env.EXPO_PUBLIC_SUPABASE_URL!,
                            process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                            { global: { headers: authHeader } }
                        );

                        // 1. Calculate Stats Locally
                        const p1Id = match.player1.id;
                        const p2Id = match.player2.id;
                        const p1Rating = match.player1.rating || 500;
                        const p2Rating = match.player2.rating || 500;

                        // Filter games for current type
                        const relevantGames = games.filter(g => g.game_type === activeGameType);
                        const p1WonRacks = relevantGames.filter(g => g.winner_id === p1Id).length;
                        const p2WonRacks = relevantGames.filter(g => g.winner_id === p2Id).length;

                        // Granular Stats Calculation
                        const p1BreakRuns = relevantGames.filter(g => g.winner_id === p1Id && g.is_break_and_run).length;
                        const p1RackRuns = relevantGames.filter(g => g.winner_id === p1Id && g.is_rack_and_run).length;
                        const p1Snaps = relevantGames.filter(g => g.winner_id === p1Id && g.is_9_on_snap).length;
                        const p1WinZips = relevantGames.filter(g => g.winner_id === p1Id && g.is_win_zip).length;
                        const p1Early8s = relevantGames.filter(g => g.winner_id === p1Id && g.is_early_8).length;

                        const p2BreakRuns = relevantGames.filter(g => g.winner_id === p2Id && g.is_break_and_run).length;
                        const p2RackRuns = relevantGames.filter(g => g.winner_id === p2Id && g.is_rack_and_run).length;
                        const p2Snaps = relevantGames.filter(g => g.winner_id === p2Id && g.is_9_on_snap).length;
                        const p2WinZips = relevantGames.filter(g => g.winner_id === p2Id && g.is_win_zip).length;
                        const p2Early8s = relevantGames.filter(g => g.winner_id === p2Id && g.is_early_8).length;

                        // Determine Match Winner (Restored)
                        const winnerId = p1WonRacks > p2WonRacks ? p1Id : p2Id;

                        // Calculate Deltas
                        // Note: BBRS expects TOTAL props for racksPlayed to determine K-Factor. 
                        // We use the player's current total racks (fetched earlier) + current set?
                        // Actually, let's use their *start of match* racks played (from DB) for K-factor?
                        // Or just pass the current stored `racks_played`.
                        const p1RacksTotal = match.player1.racks_played || 0;
                        const p2RacksTotal = match.player2.racks_played || 0;

                        const p1Delta = BBRS.calculateSetRatingChange(p1Rating, p2Rating, p1WonRacks, p2WonRacks, p1RacksTotal, true);
                        const p2Delta = BBRS.calculateSetRatingChange(p2Rating, p1Rating, p2WonRacks, p1WonRacks, p2RacksTotal, true);

                        // 2. Call RPC to Finalize and Update Stats
                        const { error } = await supabaseAuthenticated.rpc('finalize_match_stats', {
                            p_match_id: id,
                            p_game_type: activeGameType,
                            p_winner_id: winnerId,
                            p_p1_delta: p1Delta,
                            p_p2_delta: p2Delta,
                            p_p1_racks_won: p1WonRacks,
                            p_p1_racks_lost: p2WonRacks,
                            p_p2_racks_won: p2WonRacks,
                            p_p2_racks_lost: p1WonRacks,

                            // Granular Stats
                            p_p1_break_runs: p1BreakRuns,
                            p_p1_rack_runs: p1RackRuns,
                            p_p1_snaps: p1Snaps,
                            p_p1_win_zips: p1WinZips,
                            p_p1_early_8s: p1Early8s,

                            p_p2_break_runs: p2BreakRuns,
                            p_p2_rack_runs: p2RackRuns,
                            p_p2_snaps: p2Snaps,
                            p_p2_win_zips: p2WinZips,
                            p_p2_early_8s: p2Early8s
                        });

                        if (error) throw error;

                        Alert.alert("Success", "Set finalized successfully.");
                        setViewMode('selection');
                        fetchMatchData();

                    } catch (e: any) {
                        console.error("Finalize Error", e);
                        Alert.alert("Error", `Failed to finalize: ${e.message}`);
                    }
                }
            }
        ]);
    };

    const handleSelectGame = (type: '8ball' | '9ball') => {
        setActiveGameType(type);
        setViewMode('scoring');
    };

    const handleEditGame = (gameId: string) => {
        router.push(`/game/${gameId}`);
    };

    if (loading || !match) {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center">
                <Text className="text-foreground">Loading...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                contentContainerStyle={{ padding: 16 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchMatchData} tintColor="#fff" />}
            >

                {viewMode === 'selection' && (
                    <View className="flex-1 pt-4">
                        <TouchableOpacity onPress={() => router.replace('/(tabs)')} className="mb-4 flex-row items-center">
                            <Ionicons name="arrow-back" size={24} color="#888" />
                            <Text className="text-foreground ml-2 font-bold">Back to Dashboard</Text>
                        </TouchableOpacity>

                        <View className="items-center justify-center mt-8 mb-8">
                            {/* Opponent Info Header */}
                            <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4">Currently Playing</Text>

                            {/* Avatar Display */}
                            <View className="flex-row items-center justify-center gap-6 mb-4">
                                {/* Player 1 (or You) */}
                                <View className="items-center">
                                    <View className={`w-24 h-24 rounded-full border-2 ${match.player1.id === userId ? 'border-primary' : 'border-gray-600'} overflow-hidden bg-surface`}>
                                        {match.player1.avatar_url ? (
                                            <Image source={{ uri: match.player1.avatar_url }} className="w-full h-full" />
                                        ) : (
                                            <View className="flex-1 items-center justify-center bg-gray-800">
                                                <Ionicons name="person" size={40} color="#666" />
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-foreground font-bold text-base mt-3 max-w-[100px] text-center" numberOfLines={1}>
                                        {match.player1.nickname || match.player1.full_name?.split(' ')[0]}
                                    </Text>
                                    <Text className="text-primary font-bold text-sm mt-1">
                                        {match.player1.rating}
                                    </Text>
                                </View>

                                <Text className="text-gray-500 font-black text-xl italic">VS</Text>

                                {/* Player 2 (or Opponent) */}
                                <View className="items-center">
                                    <View className={`w-24 h-24 rounded-full border-2 ${match.player2.id === userId ? 'border-primary' : 'border-gray-600'} overflow-hidden bg-surface`}>
                                        {match.player2.avatar_url ? (
                                            <Image source={{ uri: match.player2.avatar_url }} className="w-full h-full" />
                                        ) : (
                                            <View className="flex-1 items-center justify-center bg-gray-800">
                                                <Ionicons name="person" size={40} color="#666" />
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-foreground font-bold text-base mt-3 max-w-[100px] text-center" numberOfLines={1}>
                                        {match.player2.nickname || match.player2.full_name?.split(' ')[0]}
                                    </Text>
                                    <Text className="text-primary font-bold text-sm mt-1">
                                        {match.player2.rating}
                                    </Text>
                                </View>
                            </View>

                            {/* Removed Ratings Block per User Request - Moved Up */}

                            <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                                WEEK {match.week_number || '?'}
                            </Text>
                            <Text className="text-gray-600 text-[10px] uppercase font-bold mt-1 tracking-widest">
                                {match.league?.name} • {match.league?.parent_league?.name}
                            </Text>
                        </View>

                        {/* 8-Ball Card */}
                        <TouchableOpacity
                            onPress={() => handleSelectGame('8ball')}
                            className={`w-full p-8 rounded-xl border border-yellow-500 bg-surface mb-6 items-center ${match.status_8ball === 'finalized' ? 'opacity-50' : ''}`}
                        >
                            <Text className="text-yellow-400 text-4xl font-black italic tracking-tighter mb-2">8-BALL</Text>
                            <Text className="text-foreground font-bold text-lg mb-2">{match.points_8ball_p1 || 0} - {match.points_8ball_p2 || 0}</Text>
                            {match.status_8ball === 'finalized' ? (
                                <View className="bg-green-600 px-3 py-1 rounded-full">
                                    <Text className="text-white text-xs font-bold uppercase">
                                        WINNER: {(match.points_8ball_p1 > match.points_8ball_p2) ? match.player1.full_name : match.player2.full_name}
                                    </Text>
                                </View>
                            ) : (
                                <View className="bg-yellow-600 px-3 py-1 rounded-full">
                                    <Text className="text-white text-xs font-bold uppercase">PLAY SET</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* 9-Ball Card */}
                        <TouchableOpacity
                            onPress={() => handleSelectGame('9ball')}
                            className={`w-full p-8 rounded-xl border border-primary bg-surface items-center ${match.status_9ball === 'finalized' ? 'opacity-50' : ''}`}
                        >
                            <Text className="text-primary text-4xl font-black italic tracking-tighter mb-2">9-BALL</Text>
                            <Text className="text-foreground font-bold text-lg mb-2">{match.points_9ball_p1 || 0} - {match.points_9ball_p2 || 0}</Text>
                            {match.status_9ball === 'finalized' ? (
                                <View className="bg-green-600 px-3 py-1 rounded-full">
                                    <Text className="text-white text-xs font-bold uppercase">
                                        WINNER: {(match.points_9ball_p1 > match.points_9ball_p2) ? match.player1.full_name : match.player2.full_name}
                                    </Text>
                                </View>
                            ) : (
                                <View className="bg-gray-600 px-3 py-1 rounded-full">
                                    <Text className="text-white text-xs font-bold uppercase">PLAY SET</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>


                )}

                {viewMode === 'scoring' && (
                    <View>
                        <TouchableOpacity onPress={() => setViewMode('selection')} className="mb-4 flex-row items-center">
                            <Ionicons name="arrow-back" size={24} color="#888" />
                            <Text className="text-foreground ml-2 font-bold">Back to Hub</Text>
                        </TouchableOpacity>

                        {/* Race Calculation Logic Lifted */}
                        {(() => {
                            const p1Score = activeGameType === '8ball' ? match.points_8ball_p1 : match.points_9ball_p1;
                            const p2Score = activeGameType === '8ball' ? match.points_8ball_p2 : match.points_9ball_p2;

                            const raceP1 = activeGameType === '8ball'
                                ? calculateRace(match.player1.rating, match.player2.rating).short.p1
                                : calculateRace(match.player1.rating, match.player2.rating, '9ball').short.p1;
                            const raceP2 = activeGameType === '8ball'
                                ? calculateRace(match.player1.rating, match.player2.rating).short.p2
                                : calculateRace(match.player1.rating, match.player2.rating, '9ball').short.p2;

                            const isRaceMet = ((p1Score || 0) >= raceP1) || ((p2Score || 0) >= raceP2);
                            const isFinalized = (activeGameType === '8ball' ? match.status_8ball : match.status_9ball) === 'finalized';

                            // If race is met, we still render the scorer, but passing props to handle the UI
                            const showFinalizeUI = isRaceMet && !isFinalized;

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
                                            player1={{ ...match.player1, name: match.player1.full_name || 'Player 1' }}
                                            player2={{ ...match.player2, name: match.player2.full_name || 'Player 2' }}
                                            games={games.filter(g => g.game_type === '8ball')}
                                            raceTo={{ p1: raceP1, p2: raceP2 }}
                                            onSubmitGame={handleSubmitGame}
                                            isSubmitting={submitting}
                                            onEditGame={handleEditGame}
                                            isRaceComplete={showFinalizeUI}
                                            isFinalized={isFinalized}
                                            onFinalize={handleVerifyAndFinalize}
                                        />
                                    ) : (
                                        <NineBallScorer
                                            matchId={match.id}
                                            player1={{ ...match.player1, name: match.player1.full_name || 'Player 1' }}
                                            player2={{ ...match.player2, name: match.player2.full_name || 'Player 2' }}
                                            games={games.filter(g => g.game_type === '9ball')}
                                            raceTo={{ p1: raceP1, p2: raceP2 }} // Use calculated race
                                            onSubmitGame={handleSubmitGame}
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
        </SafeAreaView >
    );
}
