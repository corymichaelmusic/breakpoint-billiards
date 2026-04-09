import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import EightBallScorer from '../../../components/EightBallScorer';
import NineBallScorer from '../../../components/NineBallScorer';
import { supabase } from '../../../lib/supabase';
import { applyRealtimeAuth } from '../../../lib/realtimeAuth';

const firstParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

async function attachScorerProfile(supabase: any, setRow: any) {
    if (!setRow?.scored_by_user_id) {
        return { ...setRow, scorer: null };
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, nickname')
        .eq('id', setRow.scored_by_user_id)
        .maybeSingle();

    if (error) throw error;

    return {
        ...setRow,
        scorer: profile || null
    };
}

export default function TeamSetScreen() {
    const rawParams = useLocalSearchParams();
    const {
        teamMatchId,
        setNumber,
        submissionId,
        submissionSetId,
        gameType,
        playerAId,
        playerBId,
        playerAName,
        playerBName,
        playerARating,
        playerBRating,
        raceP1,
        raceP2,
        teamAId,
        teamBId,
        userTeamId
    } = rawParams;
    const router = useRouter();
    const { userId, getToken } = useAuth();

    const teamMatchIdParam = firstParam(teamMatchId);
    const setNumberParam = firstParam(setNumber);
    const submissionIdParam = firstParam(submissionId);
    const submissionSetIdParam = firstParam(submissionSetId);
    const playerAIdParam = firstParam(playerAId);
    const playerBIdParam = firstParam(playerBId);
    const playerANameParam = firstParam(playerAName);
    const playerBNameParam = firstParam(playerBName);
    const playerARatingParam = firstParam(playerARating);
    const playerBRatingParam = firstParam(playerBRating);
    const raceP1Param = firstParam(raceP1);
    const raceP2Param = firstParam(raceP2);
    const teamAIdParam = firstParam(teamAId);
    const teamBIdParam = firstParam(teamBId);
    const userTeamIdParam = firstParam(userTeamId);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submission, setSubmission] = useState<any>(null);
    const [setRow, setSetRow] = useState<any>(null);
    const [games, setGames] = useState<any[]>([]);
    const [player1, setPlayer1] = useState<any>(null);
    const [player2, setPlayer2] = useState<any>(null);
    const [outcomePromptVisible, setOutcomePromptVisible] = useState(false);
    const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null);
    const [editingGameId, setEditingGameId] = useState<string | null>(null);
    const lastLoadKeyRef = useRef<string | null>(null);
    const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const match = useMemo(() => ({
        team_a_id: teamAIdParam,
        team_b_id: teamBIdParam
    }), [teamAIdParam, teamBIdParam]);

    const createSupabaseClient = useCallback(async () => {
        const token = await getToken({ template: 'supabase' });
        return createClient(
            process.env.EXPO_PUBLIC_SUPABASE_URL!,
            process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
    }, [getToken]);

    const loadScreenData = useCallback(async (force = false, options?: { silent?: boolean }) => {
        let cancelled = false;
        const loadKey = [
            teamMatchIdParam,
            setNumberParam,
            submissionIdParam,
            submissionSetIdParam,
            playerAIdParam,
            playerBIdParam,
            playerANameParam,
            playerBNameParam,
            playerARatingParam,
            playerBRatingParam,
            raceP1Param,
            raceP2Param,
            teamAIdParam,
            teamBIdParam,
            userTeamIdParam,
            userId
        ].join('|');

        if (!teamMatchIdParam || !setNumberParam || !userId) return () => {};
        if (!force && lastLoadKeyRef.current === loadKey) return () => {};
        lastLoadKeyRef.current = loadKey;

        async function loadScreen() {
            if (!options?.silent) {
                setLoading(true);
            }

            try {
                const supabase = await createSupabaseClient();
                if (cancelled) return;

                let captainSubmission: any = submissionIdParam ? { id: submissionIdParam } : null;
                if (!captainSubmission) {
                    const { data: fallbackSubmission, error: submissionError } = await supabase
                        .from('team_match_captain_submissions')
                        .select('*')
                        .eq('team_match_id', teamMatchIdParam)
                        .eq('team_id', userTeamIdParam)
                        .maybeSingle();

                    if (submissionError) throw submissionError;
                    if (!fallbackSubmission) {
                        Alert.alert("Missing Team Card", "Open the team match screen first to set up this set.");
                        router.back();
                        return;
                    }
                    captainSubmission = fallbackSubmission;
                }

                if (cancelled) return;
                setSubmission(captainSubmission);

                let submissionSet: any = null;
                if (submissionSetIdParam) {
                    const { data: existingSet, error: existingSetError } = await supabase
                        .from('team_match_submission_sets')
                        .select('*')
                        .eq('id', submissionSetIdParam)
                        .single();

                    if (existingSetError) throw existingSetError;
                    submissionSet = await attachScorerProfile(supabase, existingSet);
                } else {
                    const { data: existingSet, error: existingSetError } = await supabase
                        .from('team_match_submission_sets')
                        .select('*')
                        .eq('captain_submission_id', captainSubmission.id)
                        .eq('set_number', Number(setNumberParam))
                        .maybeSingle();

                    if (existingSetError) throw existingSetError;
                    if (!existingSet) {
                        Alert.alert("Set Not Ready", "Choose the lineup for this set from the team match screen first.");
                        router.back();
                        return;
                    }
                    submissionSet = await attachScorerProfile(supabase, existingSet);
                }

                if (cancelled) return;
                setSetRow(submissionSet);

                const { data: gameRows, error: gamesError } = await supabase
                    .from('team_match_submission_games')
                    .select('*')
                    .eq('submission_set_id', submissionSet.id)
                    .order('game_number', { ascending: true });

                if (gamesError) throw gamesError;
                if (cancelled) return;
                setGames(gameRows || []);

                const resolvedPlayerAId = submissionSet.player_a_id || playerAIdParam;
                const resolvedPlayerBId = submissionSet.player_b_id || playerBIdParam;

                if (!resolvedPlayerAId || !resolvedPlayerBId) {
                    Alert.alert("Set Not Ready", "Choose the lineup for this set from the team match screen first.");
                    router.back();
                    return;
                }

                setPlayer1({
                    id: String(resolvedPlayerAId),
                    name: String(playerANameParam || 'Player 1'),
                    rating: Number(playerARatingParam || 500)
                });
                setPlayer2({
                    id: String(resolvedPlayerBId),
                    name: String(playerBNameParam || 'Player 2'),
                    rating: Number(playerBRatingParam || 500)
                });
            } catch (e) {
                console.error("Load Team Set Error", e);
                if (!options?.silent) {
                    Alert.alert("Error", "Failed to load the team set.");
                    router.back();
                }
            } finally {
                if (!cancelled && !options?.silent) setLoading(false);
            }
        }

        await loadScreen();

        return () => {
            cancelled = true;
        };
    }, [
        createSupabaseClient,
        playerAIdParam,
        playerANameParam,
        playerARatingParam,
        playerBIdParam,
        playerBNameParam,
        playerBRatingParam,
        raceP1Param,
        raceP2Param,
        router,
        setNumberParam,
        submissionIdParam,
        submissionSetIdParam,
        teamAIdParam,
        teamBIdParam,
        teamMatchIdParam,
        userId,
        userTeamIdParam
    ]);

    useEffect(() => {
        let cleanup: (() => void) | undefined;

        loadScreenData().then((returnedCleanup) => {
            cleanup = returnedCleanup;
        });

        return () => {
            cleanup?.();
        };
    }, [
        loadScreenData
    ]);

    useEffect(() => {
        let isMounted = true;

        async function setupRealtimeAuth() {
            const token = await getToken({ template: 'supabase' });
            if (!isMounted) return;
            await applyRealtimeAuth(token);
        }

        setupRealtimeAuth();

        return () => {
            isMounted = false;
        };
    }, [getToken]);

    useEffect(() => {
        const activeSubmissionSetId = setRow?.id || submissionSetIdParam;
        if (!activeSubmissionSetId || !userId) return;

        const safeRefresh = () => {
            if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
            realtimeDebounceRef.current = setTimeout(() => {
                loadScreenData(true, { silent: true });
            }, 150);
        };

        const setChannel = supabase
            .channel(`team-set:${activeSubmissionSetId}:set`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'team_match_submission_sets',
                filter: `id=eq.${activeSubmissionSetId}`
            }, safeRefresh)
            .subscribe();

        const gamesChannel = supabase
            .channel(`team-set:${activeSubmissionSetId}:games`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'team_match_submission_games',
                filter: `submission_set_id=eq.${activeSubmissionSetId}`
            }, safeRefresh)
            .subscribe();

        return () => {
            supabase.removeChannel(setChannel);
            supabase.removeChannel(gamesChannel);
            if (realtimeDebounceRef.current) {
                clearTimeout(realtimeDebounceRef.current);
                realtimeDebounceRef.current = null;
            }
        };
    }, [loadScreenData, setRow?.id, submissionSetIdParam, userId]);

    const activeScorerName = setRow?.scorer?.nickname || setRow?.scorer?.full_name || 'another teammate';
    const isOwnedByCurrentUser = setRow?.scored_by_user_id === userId;
    const canEditSet = isOwnedByCurrentUser;

    const p1Wins = games.filter((game) => game.winner_id === player1?.id).length;
    const p2Wins = games.filter((game) => game.winner_id === player2?.id).length;
    const resolvedRace = useMemo(() => {
        return {
            p1: Number(setRow?.race_p1 || raceP1Param || 0),
            p2: Number(setRow?.race_p2 || raceP2Param || 0)
        };
    }, [raceP1Param, raceP2Param, setRow]);
    const hasValidRace = resolvedRace.p1 > 0 && resolvedRace.p2 > 0;
    const isRaceComplete = !!setRow && !!player1 && !!player2 && hasValidRace && (
        p1Wins >= resolvedRace.p1 ||
        p2Wins >= resolvedRace.p2
    );

    const handleRequestOutcome = (winnerId: string) => {
        if (!canEditSet) {
            Alert.alert("Set In Use", `${activeScorerName} is currently scoring this set.`);
            return;
        }
        setEditingGameId(null);
        setPendingWinnerId(winnerId);
        setOutcomePromptVisible(true);
    };

    const handleEditGame = (gameId: string) => {
        if (!canEditSet) {
            Alert.alert("Set In Use", `${activeScorerName} is currently scoring this set.`);
            return;
        }
        const game = games.find((row) => row.id === gameId);
        if (!game) return;

        setEditingGameId(game.id);
        setPendingWinnerId(game.winner_id);
        setOutcomePromptVisible(true);
    };

    const handleCommitOutcome = async (outcome: string) => {
        if (!pendingWinnerId || !setRow) return;
        if (!canEditSet) {
            Alert.alert("Set In Use", `${activeScorerName} is currently scoring this set.`);
            return;
        }

        try {
            setSaving(true);
            const supabase = await createSupabaseClient();
            const payload = {
                winner_id: pendingWinnerId,
                is_break_and_run: outcome === 'break_run',
                is_rack_and_run: outcome === 'rack_run',
                is_9_on_snap: outcome === '9_snap',
                is_early_8: outcome === 'early_8',
                is_scratch_8: outcome === 'scratch_8'
            };

            if (editingGameId) {
                const { data: updatedGame, error } = await supabase
                    .from('team_match_submission_games')
                    .update({
                        ...payload,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingGameId)
                    .select('*')
                    .single();

                if (error) throw error;

                setGames((currentGames) =>
                    currentGames
                        .map((game) => (game.id === editingGameId ? updatedGame : game))
                        .sort((a, b) => a.game_number - b.game_number)
                );
            } else {
                const nextGameNumber = games.length + 1;
                const { data: newGame, error } = await supabase
                    .from('team_match_submission_games')
                    .insert({
                        submission_set_id: setRow.id,
                        game_number: nextGameNumber,
                        ...payload
                    })
                    .select('*')
                    .single();

                if (error) throw error;

                setGames((currentGames) => [...currentGames, newGame].sort((a, b) => a.game_number - b.game_number));
            }
        } catch (e) {
            console.error("Save Team Set Game Error", e);
            Alert.alert("Error", "Failed to save the rack.");
        } finally {
            setOutcomePromptVisible(false);
            setPendingWinnerId(null);
            setEditingGameId(null);
            setSaving(false);
        }
    };

    const handleFinishSet = async () => {
        if (!setRow || !match || !submission) return;
        if (!canEditSet) {
            Alert.alert("Set In Use", `${activeScorerName} is currently scoring this set.`);
            return;
        }

        if (!hasValidRace) {
            Alert.alert("Race Not Ready", "The race target is still loading. Go back to the team match and reopen this set.");
            return;
        }

        const winnerTeamId = p1Wins >= resolvedRace.p1 ? match.team_a_id : match.team_b_id;
        try {
            setSaving(true);
            const supabase = await createSupabaseClient();
            const { error } = await supabase
                .from('team_match_submission_sets')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    completed_by_user_id: userId,
                    scored_by_user_id: null,
                    scoring_claimed_at: null,
                    handoff_code_hash: null,
                    handoff_code_expires_at: null,
                    handoff_requested_at: null,
                    winner_team_id: winnerTeamId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', setRow.id);

            if (error) throw error;

            router.back();
        } catch (e) {
            console.error("Finish Team Set Error", e);
            Alert.alert("Error", "Failed to finish the set.");
        } finally {
            setSaving(false);
        }
    };

    const handleResetSet = async () => {
        if (!setRow) return;
        if (!canEditSet) {
            Alert.alert("Set In Use", `${activeScorerName} is currently scoring this set.`);
            return;
        }

        Alert.alert(
            "Reset Set",
            "Clear this set completely, remove the selected players, and return to the team match screen?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setSaving(true);
                            const supabase = await createSupabaseClient();
                            const { error: deleteError } = await supabase
                                .from('team_match_submission_games')
                                .delete()
                                .eq('submission_set_id', setRow.id);

                            if (deleteError) throw deleteError;

                            const { error: updateError } = await supabase
                                .from('team_match_submission_sets')
                                .update({
                                    player_a_id: null,
                                    player_b_id: null,
                                    race_p1: null,
                                    race_p2: null,
                                    status: 'pending',
                                    completed_at: null,
                                    winner_team_id: null,
                                    handoff_code_hash: null,
                                    handoff_code_expires_at: null,
                                    handoff_requested_at: null,
                                    scored_by_user_id: null,
                                    scoring_claimed_at: null,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', setRow.id);

                            if (updateError) throw updateError;
                            router.replace(`/team-match/${teamMatchIdParam}`);
                        } catch (e) {
                            console.error("Reset Team Set Error", e);
                            Alert.alert("Error", "Failed to reset the set.");
                        } finally {
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };

    const handleHandOffSet = async () => {
        if (!setRow?.id) return;
        if (!canEditSet) {
            Alert.alert("Set In Use", `${activeScorerName} is currently scoring this set.`);
            return;
        }
        try {
            setSaving(true);
            const supabase = await createSupabaseClient();
            const { data, error } = await supabase.rpc('create_team_match_set_handoff_code', {
                p_submission_set_id: setRow.id
            });

            if (error) throw error;

            const result = data as { success: boolean; error?: string; handoff_code?: string };
            if (!result?.success || !result?.handoff_code) {
                Alert.alert("Error", result?.error || "Failed to generate a handoff code.");
                return;
            }

            Alert.alert(
                "Handoff Code",
                `Have the other phone enter ${result.handoff_code} to take over this set.`,
                [
                    {
                        text: "Back to Match",
                        onPress: () => router.replace(`/team-match/${teamMatchIdParam}`)
                    },
                    { text: "Stay Here", style: "cancel" }
                ]
            );
        } catch (e) {
            console.error("Hand Off Team Set Error", e);
            Alert.alert("Error", "Failed to generate a handoff code.");
        } finally {
            setSaving(false);
        }
    };

    if (loading || !setRow || !player1 || !player2) {
        return (
            <SafeAreaView className="flex-1 bg-background justify-center items-center">
                <ActivityIndicator color="#D4AF37" size="large" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-black" edges={['top', 'left', 'right']}>
            <View className="px-4 py-2 border-b border-border/10">
                <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
                    <Ionicons name="arrow-back" size={24} color="#888" />
                    <Text className="text-foreground ml-2 font-bold">Back to Team Match</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                {!setRow?.scored_by_user_id ? (
                    <View className="mt-4 mb-4 bg-surface border border-border rounded-xl p-4">
                        <Text className="text-white font-bold text-center mb-1">Set Not Claimed</Text>
                        <Text className="text-gray-300 text-center text-sm">
                            Claim this set from the team match screen before making changes.
                        </Text>
                    </View>
                ) : !canEditSet ? (
                    <View className="mt-4 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                        <Text className="text-amber-300 font-bold text-center mb-1">Set In Use</Text>
                        <Text className="text-gray-300 text-center text-sm">
                            {activeScorerName} is currently scoring this set for your team. Ask them to hand it off before making changes.
                        </Text>
                    </View>
                ) : (
                    <View className="mt-4 mb-4 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                        <Text className="text-blue-300 font-bold text-center mb-1">You Own This Set</Text>
                        <Text className="text-gray-300 text-center text-sm">
                            Your phone controls scoring for this set until you hand it off or finish the set.
                        </Text>
                    </View>
                )}

                {setRow.game_type === '8ball' ? (
                    <EightBallScorer
                        matchId={setRow.id}
                        player1={player1}
                        player2={player2}
                        games={games}
                        raceTo={resolvedRace}
                        onRequestOutcome={handleRequestOutcome}
                        isSubmitting={saving}
                        onEditGame={handleEditGame}
                        isRaceComplete={isRaceComplete}
                        onFinalize={handleFinishSet}
                    />
                ) : (
                    <NineBallScorer
                        matchId={setRow.id}
                        player1={player1}
                        player2={player2}
                        games={games}
                        raceTo={resolvedRace}
                        onRequestOutcome={handleRequestOutcome}
                        isSubmitting={saving}
                        onEditGame={handleEditGame}
                        isRaceComplete={isRaceComplete}
                        onFinalize={handleFinishSet}
                    />
                )}

                <TouchableOpacity
                    onPress={handleResetSet}
                    disabled={saving || games.length === 0 || !canEditSet}
                    className={`mt-6 py-3 rounded-xl items-center border border-red-500/40 ${saving || games.length === 0 || !canEditSet ? 'opacity-40' : 'opacity-100'}`}
                >
                    <Text className="text-red-400 font-bold uppercase tracking-wider">Reset Set</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleHandOffSet}
                    disabled={saving || !isOwnedByCurrentUser}
                    className={`mt-4 py-3 rounded-xl items-center border border-blue-500/40 ${saving || !isOwnedByCurrentUser ? 'opacity-40' : 'opacity-100'}`}
                >
                    <Text className="text-blue-300 font-bold uppercase tracking-wider">Generate Handoff Code</Text>
                </TouchableOpacity>
            </ScrollView>

            <Modal visible={outcomePromptVisible} transparent animationType="fade">
                <View className="flex-1 justify-end">
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => {
                            setOutcomePromptVisible(false);
                            setPendingWinnerId(null);
                            setEditingGameId(null);
                        }}
                        className="absolute inset-0 bg-black/80"
                    />
                    <View className="bg-surface rounded-t-3xl p-6 border-t border-gray-700">
                        <View className="items-center mb-6">
                            <View className="w-12 h-1 bg-gray-600 rounded-full mb-4" />
                            <Text className="text-white text-xl font-bold text-center">
                                {editingGameId ? 'Edit Rack' : 'How did'} {pendingWinnerId === player1.id ? player1.name : player2.name} win?
                            </Text>
                        </View>

                        <View className="gap-3 mb-4">
                            {setRow.game_type === '8ball' ? (
                                <>
                                    <TouchableOpacity onPress={() => handleCommitOutcome('made_8')} className="bg-gray-700 p-4 rounded-xl">
                                        <Text className="text-white font-bold text-lg">Made 8-Ball</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleCommitOutcome('break_run')} className="bg-yellow-600/20 border border-yellow-600 p-4 rounded-xl">
                                        <Text className="text-yellow-500 font-bold text-lg">Break & Run</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleCommitOutcome('rack_run')} className="bg-green-600/20 border border-green-600 p-4 rounded-xl">
                                        <Text className="text-green-500 font-bold text-lg">Rack & Run</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleCommitOutcome('early_8')} className="bg-red-600/20 border border-red-600 p-4 rounded-xl">
                                        <Text className="text-red-500 font-bold text-lg">Opponent Early 8</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleCommitOutcome('scratch_8')} className="bg-red-600/20 border border-red-600 p-4 rounded-xl">
                                        <Text className="text-red-500 font-bold text-lg">Opponent Scratch on 8</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity onPress={() => handleCommitOutcome('made_9')} className="bg-gray-700 p-4 rounded-xl">
                                        <Text className="text-white font-bold text-lg">Made 9-Ball</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleCommitOutcome('break_run')} className="bg-yellow-600/20 border border-yellow-600 p-4 rounded-xl">
                                        <Text className="text-yellow-500 font-bold text-lg">Break & Run</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleCommitOutcome('9_snap')} className="bg-green-600/20 border border-green-600 p-4 rounded-xl">
                                        <Text className="text-green-500 font-bold text-lg">9 on the Snap</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>

                        <TouchableOpacity onPress={() => {
                            setOutcomePromptVisible(false);
                            setPendingWinnerId(null);
                            setEditingGameId(null);
                        }} className="py-3 items-center">
                            <Text className="text-gray-400 font-bold">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
