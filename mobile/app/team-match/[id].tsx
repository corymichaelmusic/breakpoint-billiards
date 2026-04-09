import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5 } from '@expo/vector-icons';
import { getBreakpointLevel } from "../../utils/rating";
import { supabase } from "../../lib/supabase";
import { applyRealtimeAuth } from "../../lib/realtimeAuth";

const EMPTY_SETS = Array.from({ length: 8 }, (_, i) => ({
    set_number: i + 1,
    game_type: i < 4 ? '8ball' : '9ball'
}));

const firstParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const getProfileDisplayName = (profile?: { nickname?: string | null; full_name?: string | null } | null) =>
    profile?.nickname || profile?.full_name || 'A teammate';

async function attachScorerProfiles(supabase: any, sets: any[]) {
    const scorerIds = Array.from(new Set(
        (sets || [])
            .map((set) => set.scored_by_user_id)
            .filter(Boolean)
    ));

    if (scorerIds.length === 0) {
        return (sets || []).map((set) => ({ ...set, scorer: null }));
    }

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, nickname')
        .in('id', scorerIds);

    if (error) throw error;

    const profilesById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
    return (sets || []).map((set) => ({
        ...set,
        scorer: set.scored_by_user_id ? profilesById.get(set.scored_by_user_id) || null : null
    }));
}

export default function TeamMatchScreen() {
    const { id } = useLocalSearchParams();
    const idParam = firstParam(id);
    const router = useRouter();
    const { getToken, userId } = useAuth();
    const getTokenRef = useRef(getToken);
    const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [match, setMatch] = useState<any>(null);
    const [teamA, setTeamA] = useState<any>(null);
    const [teamB, setTeamB] = useState<any>(null);
    const [teamAMembers, setTeamAMembers] = useState<any[]>([]);
    const [teamBMembers, setTeamBMembers] = useState<any[]>([]);
    const [submission, setSubmission] = useState<any>(null);
    const [submissionSets, setSubmissionSets] = useState<Record<number, any>>({});
    const [userTeamId, setUserTeamId] = useState<string | null>(null);

    const [selectedSet, setSelectedSet] = useState<any>(null);
    const [playerAId, setPlayerAId] = useState<string | null>(null);
    const [playerBId, setPlayerBId] = useState<string | null>(null);
    const [pendingCoinFlipTeamId, setPendingCoinFlipTeamId] = useState<string | null>(null);
    const [handoffCodeModalSet, setHandoffCodeModalSet] = useState<any>(null);
    const [handoffCodeValue, setHandoffCodeValue] = useState("");
    const [claimCodeModalSet, setClaimCodeModalSet] = useState<any>(null);
    const [claimCodeValue, setClaimCodeValue] = useState("");
    const isSubmissionLocked =
        submission?.verification_status === 'submitted' ||
        submission?.verification_status === 'verified' ||
        match?.status === 'completed';

    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    const createSupabaseClient = useCallback(async () => {
        const token = await getTokenRef.current({ template: 'supabase' });
        return createClient(
            process.env.EXPO_PUBLIC_SUPABASE_URL!,
            process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
    }, []);

    const ensureSubmission = useCallback(async (supabase: any, captainTeamId: string) => {
        const { data: existingSubmission, error: existingError } = await supabase
            .from('team_match_captain_submissions')
            .select('*')
            .eq('team_match_id', idParam)
            .eq('team_id', captainTeamId)
            .maybeSingle();

        if (existingError) throw existingError;
        if (existingSubmission) return existingSubmission;

        const { data: createdSubmission, error: createError } = await supabase
            .from('team_match_captain_submissions')
            .insert({
                team_match_id: idParam,
                team_id: captainTeamId,
                submitted_by: userId
            })
            .select('*')
            .single();

        if (createError) throw createError;
        return createdSubmission;
    }, [idParam, userId]);

    const isCaptain = (teamId?: string | null) => {
        if (!teamId) return false;
        if (teamId === teamA?.id && teamA?.captain_id === userId) return true;
        if (teamId === teamB?.id && teamB?.captain_id === userId) return true;
        return false;
    };

    const fetchScreenData = useCallback(async (options?: { silent?: boolean }) => {
        if (!userId || !idParam) return;
        if (!options?.silent) {
            setLoading(true);
        }

        try {
            const token = await getTokenRef.current({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            const { data: matchData, error: matchError } = await supabase
                .from('team_matches')
                .select('*, league:league_id(*, parent_league:parent_league_id(*)), team_a:team_a_id(*), team_b:team_b_id(*)')
                .eq('id', idParam)
                .single();

            if (matchError) throw matchError;

            setMatch(matchData);
            setTeamA(matchData.team_a);
            setTeamB(matchData.team_b);

            const { data: membersA } = await supabase
                .from('team_members')
                .select('*, profiles(*)')
                .eq('team_id', matchData.team_a_id);

            const { data: membersB } = await supabase
                .from('team_members')
                .select('*, profiles(*)')
                .eq('team_id', matchData.team_b_id);

            setTeamAMembers(membersA || []);
            setTeamBMembers(membersB || []);

            const isOnTeamA =
                matchData.team_a?.captain_id === userId ||
                (membersA || []).some((member: any) => member.player_id === userId);
            const isOnTeamB =
                matchData.team_b?.captain_id === userId ||
                (membersB || []).some((member: any) => member.player_id === userId);
            const currentUserTeamId =
                isOnTeamA ? matchData.team_a_id :
                isOnTeamB ? matchData.team_b_id :
                null;

            setUserTeamId(currentUserTeamId);

            if (currentUserTeamId) {
                const { data: existingSubmission, error: submissionError } = await supabase
                    .from('team_match_captain_submissions')
                    .select('*')
                    .eq('team_match_id', idParam)
                    .eq('team_id', currentUserTeamId)
                    .maybeSingle();

                if (submissionError) throw submissionError;
                setSubmission(existingSubmission || null);

                if (existingSubmission) {
                    const { data: setRows, error: setError } = await supabase
                        .from('team_match_submission_sets')
                        .select('*')
                        .eq('captain_submission_id', existingSubmission.id)
                        .order('set_number', { ascending: true });

                    if (setError) throw setError;
                    const hydratedSetRows = await attachScorerProfiles(supabase, setRows || []);

                    setSubmissionSets(
                        hydratedSetRows.reduce((acc: Record<number, any>, row: any) => {
                            acc[row.set_number] = row;
                            return acc;
                        }, {})
                    );
                } else {
                    setSubmissionSets({});
                }
            } else {
                setSubmission(null);
                setSubmissionSets({});
            }
        } catch (e) {
            console.error("Fetch Team Match Error", e);
            if (!options?.silent) {
                Alert.alert("Error", "Failed to load team match.");
            }
        } finally {
            if (!options?.silent) {
                setLoading(false);
            }
        }
    }, [idParam, userId]);

    useEffect(() => {
        fetchScreenData();
    }, [fetchScreenData]);

    useFocusEffect(
        useCallback(() => {
            fetchScreenData();
        }, [fetchScreenData])
    );

    useEffect(() => {
        let isMounted = true;

        async function setupRealtimeAuth() {
            const token = await getTokenRef.current({ template: 'supabase' });
            if (!isMounted) return;
            await applyRealtimeAuth(token);
        }

        setupRealtimeAuth();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!idParam || !userId || !userTeamId) return;

        const safeRefresh = () => {
            if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
            realtimeDebounceRef.current = setTimeout(() => {
                fetchScreenData({ silent: true });
            }, 150);
        };

        const submissionChannel = supabase
            .channel(`team-match:${idParam}:submission:${userTeamId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'team_match_captain_submissions',
                filter: `team_match_id=eq.${idParam}`
            }, safeRefresh)
            .subscribe();

        let setChannel: ReturnType<typeof supabase.channel> | null = null;
        if (submission?.id) {
            setChannel = supabase
                .channel(`team-match:${idParam}:sets:${submission.id}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'team_match_submission_sets',
                    filter: `captain_submission_id=eq.${submission.id}`
                }, safeRefresh)
                .subscribe();
        }

        return () => {
            supabase.removeChannel(submissionChannel);
            if (setChannel) supabase.removeChannel(setChannel);
            if (realtimeDebounceRef.current) {
                clearTimeout(realtimeDebounceRef.current);
                realtimeDebounceRef.current = null;
            }
        };
    }, [fetchScreenData, idParam, submission?.id, userId, userTeamId]);

    useEffect(() => {
        return () => {
            setSelectedSet(null);
            setPlayerAId(null);
            setPlayerBId(null);
            setPendingCoinFlipTeamId(null);
            setHandoffCodeModalSet(null);
            setHandoffCodeValue("");
            setClaimCodeModalSet(null);
            setClaimCodeValue("");
        };
    }, []);

    useEffect(() => {
        if (!isSubmissionLocked) return;
        setSelectedSet(null);
        setPlayerAId(null);
        setPlayerBId(null);
        setPendingCoinFlipTeamId(null);
        setHandoffCodeModalSet(null);
        setHandoffCodeValue("");
        setClaimCodeModalSet(null);
        setClaimCodeValue("");
    }, [isSubmissionLocked]);

    const calculateTeamLevelSum = (
        isTeamA: boolean,
        pendingPlayerId: string | null,
        gameType?: '8ball' | '9ball'
    ) => {
        const activeIds = new Set<string>();
        if (pendingPlayerId) activeIds.add(pendingPlayerId);

        Object.values(submissionSets).forEach((set: any) => {
            if (gameType && set.game_type !== gameType) return;
            if (isTeamA && set.player_a_id) activeIds.add(set.player_a_id);
            if (!isTeamA && set.player_b_id) activeIds.add(set.player_b_id);
        });

        let sum = 0;
        const members = isTeamA ? teamAMembers : teamBMembers;
        activeIds.forEach((memberId) => {
            const member = members.find((row) => row.player_id === memberId);
            if (member?.profiles?.breakpoint_rating) {
                sum += parseFloat(getBreakpointLevel(member.profiles.breakpoint_rating));
            } else if (member) {
                sum += 5.0;
            }
        });

        return Number(sum.toFixed(1));
    };

    const selectedGameType = selectedSet?.game_type as '8ball' | '9ball' | undefined;
    const currentTeamALevelSum = calculateTeamLevelSum(true, playerAId, selectedGameType);
    const currentTeamBLevelSum = calculateTeamLevelSum(false, playerBId, selectedGameType);

    const localWins = Object.values(submissionSets).reduce((total: number, set: any) => {
        if (set.winner_team_id === userTeamId) return total + 1;
        return total;
    }, 0);

    const opponentWins = Object.values(submissionSets).reduce((total: number, set: any) => {
        if (set.winner_team_id && set.winner_team_id !== userTeamId) return total + 1;
        return total;
    }, 0);
    const localEightBallWins = Object.values(submissionSets).reduce((total: number, set: any) => {
        if (set.game_type === '8ball' && set.winner_team_id === userTeamId) return total + 1;
        return total;
    }, 0);
    const localEightBallLosses = Object.values(submissionSets).reduce((total: number, set: any) => {
        if (set.game_type === '8ball' && set.winner_team_id && set.winner_team_id !== userTeamId) return total + 1;
        return total;
    }, 0);
    const localNineBallWins = Object.values(submissionSets).reduce((total: number, set: any) => {
        if (set.game_type === '9ball' && set.winner_team_id === userTeamId) return total + 1;
        return total;
    }, 0);
    const localNineBallLosses = Object.values(submissionSets).reduce((total: number, set: any) => {
        if (set.game_type === '9ball' && set.winner_team_id && set.winner_team_id !== userTeamId) return total + 1;
        return total;
    }, 0);

    const handleSaveCoinFlip = async () => {
        if (!userTeamId || !pendingCoinFlipTeamId) return;
        if (isSubmissionLocked) {
            Alert.alert("Match Submitted", "This match has already been submitted and can no longer be edited.");
            return;
        }

        const teamIdToSave = pendingCoinFlipTeamId;

        try {
            setSaving(true);
            setPendingCoinFlipTeamId(null);
            const supabase = await createSupabaseClient();
            const ensuredSubmission = submission || await ensureSubmission(supabase, userTeamId!);
            const { error } = await supabase
                .from('team_match_captain_submissions')
                .update({
                    put_up_first_team_id: teamIdToSave,
                    verification_status: 'draft',
                    updated_at: new Date().toISOString()
                })
                .eq('id', ensuredSubmission.id);

            if (error) throw error;
            await fetchScreenData();
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to save the coin flip.");
        } finally {
            setSaving(false);
        }
    };

    const openSetModal = (setConfig: any) => {
        if (isSubmissionLocked) {
            Alert.alert("Match Submitted", "This match has already been submitted and can no longer be edited.");
            return;
        }
        const existing = submissionSets[setConfig.set_number];
        setSelectedSet(setConfig);
        setPlayerAId(existing?.player_a_id || null);
        setPlayerBId(existing?.player_b_id || null);
    };

    const handleClaimSet = async (setConfig: any, set?: any) => {
        if (!idParam || !userTeamId) return;
        if (isSubmissionLocked) {
            Alert.alert("Match Submitted", "This match has already been submitted and can no longer be edited.");
            return;
        }

        try {
            setSaving(true);
            const supabase = await createSupabaseClient();
            const { data, error } = await supabase.rpc('claim_team_match_submission_set', {
                p_team_match_id: idParam,
                p_set_number: setConfig.set_number,
                p_game_type: set?.game_type || setConfig.game_type
            });

            if (error) throw error;

            const result = data as {
                success: boolean;
                error?: string;
                status?: string;
                submission_id?: string;
                submission_set_id?: string;
                scored_by_user_id?: string | null;
                scored_by_name?: string | null;
            };

            if (!result?.success) {
                if (result?.status === 'owned_by_other') {
                    Alert.alert(
                        "Set Already Claimed",
                        `${result.scored_by_name || 'Another teammate'} is already scoring Set ${setConfig.set_number}. Ask them to hand it off before continuing.`
                    );
                    return;
                }

                Alert.alert("Error", result?.error || "Failed to open this set.");
                return;
            }

            await fetchScreenData();

            if (set?.player_a_id && set?.player_b_id) {
                openSetScoring(setConfig, {
                    ...set,
                    id: result.submission_set_id || set.id,
                    scored_by_user_id: result.scored_by_user_id || userId
                });
                return;
            }

            openSetModal(setConfig);
        } catch (e) {
            console.error("Claim Team Set Error", e);
            Alert.alert("Error", "Failed to claim this set.");
        } finally {
            setSaving(false);
        }
    };

    const handleHandOffSet = async (set: any) => {
        if (!set?.id) return;
        if (isSubmissionLocked) {
            Alert.alert("Match Submitted", "This match has already been submitted and can no longer be edited.");
            return;
        }
        try {
            setSaving(true);
            const supabase = await createSupabaseClient();
            const { data, error } = await supabase.rpc('create_team_match_set_handoff_code', {
                p_submission_set_id: set.id
            });

            if (error) throw error;

            const result = data as { success: boolean; error?: string; handoff_code?: string };
            if (!result?.success || !result?.handoff_code) {
                Alert.alert("Error", result?.error || "Failed to generate a handoff code.");
                return;
            }

            setHandoffCodeValue(result.handoff_code);
            setHandoffCodeModalSet(set);
            await fetchScreenData();
        } catch (e) {
            console.error("Create Handoff Code Error", e);
            Alert.alert("Error", "Failed to generate a handoff code.");
        } finally {
            setSaving(false);
        }
    };

    const handleClaimWithCode = async () => {
        if (!claimCodeModalSet?.id || !claimCodeValue.trim()) {
            Alert.alert("Enter Code", "Enter the handoff code from the other phone.");
            return;
        }
        if (isSubmissionLocked) {
            Alert.alert("Match Submitted", "This match has already been submitted and can no longer be edited.");
            return;
        }

        try {
            setSaving(true);
            const supabase = await createSupabaseClient();
            const { data, error } = await supabase.rpc('claim_team_match_submission_set_with_code', {
                p_submission_set_id: claimCodeModalSet.id,
                p_handoff_code: claimCodeValue.trim()
            });

            if (error) throw error;

            const result = data as {
                success: boolean;
                error?: string;
                submission_set_id?: string;
                scored_by_user_id?: string | null;
            };

            if (!result?.success) {
                Alert.alert("Error", result?.error || "Failed to claim this set.");
                return;
            }

            const setConfig = EMPTY_SETS.find((candidate) => candidate.set_number === claimCodeModalSet.set_number);
            setClaimCodeModalSet(null);
            setClaimCodeValue("");
            await fetchScreenData();

            if (setConfig) {
                if (claimCodeModalSet.player_a_id && claimCodeModalSet.player_b_id) {
                    openSetScoring(setConfig, {
                        ...claimCodeModalSet,
                        id: result.submission_set_id || claimCodeModalSet.id,
                        scored_by_user_id: result.scored_by_user_id || userId
                    });
                } else {
                    openSetModal(setConfig);
                }
            }
        } catch (e) {
            console.error("Claim Team Set With Code Error", e);
            Alert.alert("Error", "Failed to claim this set.");
        } finally {
            setSaving(false);
        }
    };

    const handleResetSetLineup = async (set: any) => {
        if (!set?.id) return;
        if (isSubmissionLocked) {
            Alert.alert("Match Submitted", "This match has already been submitted and can no longer be edited.");
            return;
        }

        Alert.alert(
            "Reset Set",
            "Clear this set completely so you can choose players again?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset Set",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setSaving(true);
                            const supabase = await createSupabaseClient();

                            const { error: deleteGamesError } = await supabase
                                .from('team_match_submission_games')
                                .delete()
                                .eq('submission_set_id', set.id);

                            if (deleteGamesError) throw deleteGamesError;

                            const { error: resetSetError } = await supabase
                                .from('team_match_submission_sets')
                                .update({
                                    player_a_id: null,
                                    player_b_id: null,
                                    race_p1: null,
                                    race_p2: null,
                                    winner_team_id: null,
                                    handoff_code_hash: null,
                                    handoff_code_expires_at: null,
                                    handoff_requested_at: null,
                                    status: 'pending',
                                    completed_at: null,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', set.id);

                            if (resetSetError) throw resetSetError;

                            await fetchScreenData();
                        } catch (e) {
                            console.error("Reset Team Match Set Error", e);
                            Alert.alert("Error", "Failed to reset this set.");
                        } finally {
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };

    const handleSaveLineup = async () => {
        if (!userTeamId || !selectedSet || !playerAId || !playerBId) {
            Alert.alert("Error", "Choose both players first.");
            return;
        }
        if (isSubmissionLocked) {
            Alert.alert("Match Submitted", "This match has already been submitted and can no longer be edited.");
            return;
        }

        try {
            setSaving(true);
            const playerA = teamAMembers.find((member) => member.player_id === playerAId);
            const playerB = teamBMembers.find((member) => member.player_id === playerBId);
            const supabase = await createSupabaseClient();
            const ensuredSubmission = submission || await ensureSubmission(supabase, userTeamId!);

            const { data: savedSet, error } = await supabase
                .from('team_match_submission_sets')
                .upsert({
                    captain_submission_id: ensuredSubmission.id,
                    set_number: selectedSet.set_number,
                    game_type: selectedSet.game_type,
                    player_a_id: playerAId,
                    player_b_id: playerBId,
                    status: 'in_progress',
                    winner_team_id: null,
                    scored_by_user_id: userId,
                    scoring_claimed_at: new Date().toISOString(),
                    completed_at: null,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'captain_submission_id,set_number' })
                .select('*')
                .single();

            if (error) throw error;

            const playerAName = playerA?.profiles?.nickname || playerA?.profiles?.full_name || 'Player 1';
            const playerBName = playerB?.profiles?.nickname || playerB?.profiles?.full_name || 'Player 2';

            setSelectedSet(null);
            setPlayerAId(null);
            setPlayerBId(null);
            router.push({
                pathname: '/team-set/[teamMatchId]/[setNumber]',
                params: {
                    teamMatchId: String(idParam),
                    setNumber: String(selectedSet.set_number),
                    submissionId: ensuredSubmission.id,
                    submissionSetId: savedSet.id,
                    gameType: savedSet.game_type,
                    playerAId: savedSet.player_a_id,
                    playerBId: savedSet.player_b_id,
                    playerAName,
                    playerBName,
                    playerARating: String(playerA?.profiles?.breakpoint_rating || 500),
                    playerBRating: String(playerB?.profiles?.breakpoint_rating || 500),
                    raceP1: savedSet.race_p1 != null ? String(savedSet.race_p1) : undefined,
                    raceP2: savedSet.race_p2 != null ? String(savedSet.race_p2) : undefined,
                    teamAId: match.team_a_id,
                    teamBId: match.team_b_id,
                    userTeamId: userTeamId
                }
            });
        } catch (e) {
            console.error("Save Lineup Error", e);
            Alert.alert("Error", "Failed to save the lineup. If another teammate claimed this set first, ask them to hand it off.");
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitMatch = async () => {
        if (!submission) return;

        try {
            setSaving(true);
            const supabase = await createSupabaseClient();
            const { data, error } = await supabase.rpc('submit_team_match_for_verification', {
                p_team_match_id: idParam
            });

            if (error) throw error;

            const result = data as { success: boolean; status?: string; error?: string; message?: string };
            if (!result?.success) {
                Alert.alert("Error", result?.error || "Failed to submit the team match.");
                return;
            }

            const navigateToMatches = () => {
                router.replace('/(tabs)/matches');
            };

            if (result.status === 'verified') {
                Alert.alert(
                    "Match Verified",
                    result.message || "Both captains matched.",
                    [{ text: "OK", onPress: navigateToMatches }]
                );
            } else if (result.status === 'disputed') {
                Alert.alert(
                    "Mismatch",
                    result.message || "Captain submissions did not match.",
                    [{ text: "OK", onPress: navigateToMatches }]
                );
            } else {
                Alert.alert(
                    "Submitted",
                    result.message || "Waiting for the other captain.",
                    [{ text: "OK", onPress: navigateToMatches }]
                );
            }
        } catch (e) {
            console.error("Submit Team Match Error", e);
            Alert.alert("Error", "Failed to submit the team match.");
        } finally {
            setSaving(false);
        }
    };

    const openSetScoring = (setConfig: any, set: any) => {
        const playerA = teamAMembers.find((member) => member.player_id === set.player_a_id);
        const playerB = teamBMembers.find((member) => member.player_id === set.player_b_id);

        router.push({
                pathname: '/team-set/[teamMatchId]/[setNumber]',
                params: {
                    teamMatchId: String(idParam),
                setNumber: String(setConfig.set_number),
                submissionId: submission?.id,
                submissionSetId: set.id,
                gameType: set.game_type || setConfig.game_type,
                playerAId: set.player_a_id,
                playerBId: set.player_b_id,
                playerAName: playerA?.profiles?.nickname || playerA?.profiles?.full_name || 'Player 1',
                playerBName: playerB?.profiles?.nickname || playerB?.profiles?.full_name || 'Player 2',
                playerARating: String(playerA?.profiles?.breakpoint_rating || 500),
                playerBRating: String(playerB?.profiles?.breakpoint_rating || 500),
                raceP1: set.race_p1 != null ? String(set.race_p1) : undefined,
                raceP2: set.race_p2 != null ? String(set.race_p2) : undefined,
                teamAId: match.team_a_id,
                teamBId: match.team_b_id,
                userTeamId: userTeamId
            }
        });
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-background justify-center items-center">
                <ActivityIndicator color="#D4AF37" size="large" />
            </SafeAreaView>
        );
    }

    if (!match) return null;

    if (!userTeamId) {
        return (
            <SafeAreaView className="flex-1 bg-background justify-center items-center px-6">
                <Text className="text-white text-xl font-bold text-center mb-2">Team Members Only</Text>
                <Text className="text-gray-400 text-center">You need to be on one of the two teams in this match to score sets.</Text>
            </SafeAreaView>
        );
    }

    const myTeamName = userTeamId === teamA?.id ? teamA?.name : teamB?.name;
    const oppTeamName = userTeamId === teamA?.id ? teamB?.name : teamA?.name;
    const putUpFirstTeamId = submission?.put_up_first_team_id || null;
    const allSetsCompleted = Object.values(submissionSets).filter((set: any) => set.status === 'completed').length === 8;
    const isWaitingForOpponentVerification = submission?.verification_status === 'submitted';
    const isVerified = submission?.verification_status === 'verified' || match?.status === 'completed';
    const canSubmitForVerification = isCaptain(userTeamId);

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="px-4 py-4 border-b border-border/50 bg-surface/30 flex-row items-center justify-between">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <FontAwesome5 name="chevron-left" size={20} color="#D4AF37" />
                </TouchableOpacity>
                <View className="items-center flex-1">
                    <Text className="text-white text-base font-bold uppercase tracking-widest text-center" numberOfLines={1}>Week {match.week_number} Matchup</Text>
                    <Text className="text-primary text-[11px] font-bold uppercase tracking-wider text-center mt-1" numberOfLines={1}>
                        {match.league?.parent_league?.name ? `${match.league.parent_league.name} - ` : ''}{match.league?.name || 'League'}
                    </Text>
                </View>
                <View className="w-10" />
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
                <View className="bg-surface border border-border rounded-xl p-4 mb-4">
                    <View className="flex-row justify-between items-center">
                        <View className="flex-1 items-center">
                            <Text className="text-white font-bold text-center mb-1" numberOfLines={1}>{myTeamName}</Text>
                            <Text className="text-primary font-bold text-3xl">{localWins}</Text>
                            <Text className="text-gray-500 text-xs mt-1">8B {localEightBallWins}-{localEightBallLosses}</Text>
                            <Text className="text-gray-500 text-xs">9B {localNineBallWins}-{localNineBallLosses}</Text>
                        </View>
                        <View className="px-4 justify-center items-center">
                            <Text className="text-gray-500 font-bold text-sm tracking-widest uppercase mb-1">Local Card</Text>
                            <Text className="text-gray-600 text-xs">Best of 8</Text>
                        </View>
                        <View className="flex-1 items-center">
                            <Text className="text-gray-300 font-bold text-center mb-1" numberOfLines={1}>{oppTeamName}</Text>
                            <Text className="text-gray-400 font-bold text-3xl">{opponentWins}</Text>
                            <Text className="text-gray-500 text-xs mt-1">8B {localEightBallLosses}-{localEightBallWins}</Text>
                            <Text className="text-gray-500 text-xs">9B {localNineBallLosses}-{localNineBallWins}</Text>
                        </View>
                    </View>
                </View>

                <View className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-6">
                    <Text className="text-blue-300 font-bold mb-1">Independent team-match card</Text>
                    <Text className="text-gray-300 text-sm leading-5">
                        Work through all 8 sets on your device, then submit the full match. Real match records and stats are only logged after both captains verify the same result.
                    </Text>
                </View>

                {!putUpFirstTeamId ? (
                    <View className="bg-primary/10 border border-primary/30 rounded-xl p-6 items-center mb-6">
                        <View className="bg-surface w-16 h-16 rounded-full items-center justify-center border border-primary/50 mb-4">
                            <FontAwesome5 name="coins" size={28} color="#D4AF37" />
                        </View>
                        <Text className="text-white font-bold text-lg mb-2">Coin Flip</Text>
                        <Text className="text-gray-400 text-center text-sm mb-6 leading-5">
                            Record which team puts up first for Set 1. This only drives your local set-order UI until both captains verify the full match.
                        </Text>
                        <View className="flex-row gap-3 w-full">
                            <TouchableOpacity
                                className={`flex-1 bg-surface border border-border rounded-lg p-3 items-center ${saving ? 'opacity-50' : 'opacity-100'}`}
                                disabled={saving}
                                onPress={() => setPendingCoinFlipTeamId(teamA.id)}
                            >
                                <Text className="text-white font-bold text-center" numberOfLines={2}>{teamA.name}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`flex-1 bg-surface border border-border rounded-lg p-3 items-center ${saving ? 'opacity-50' : 'opacity-100'}`}
                                disabled={saving}
                                onPress={() => setPendingCoinFlipTeamId(teamB.id)}
                            >
                                <Text className="text-white font-bold text-center" numberOfLines={2}>{teamB.name}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    EMPTY_SETS.map((setConfig, index) => {
                        const set = submissionSets[setConfig.set_number];
                        const showSectionHeader = index === 0 || EMPTY_SETS[index - 1].game_type !== setConfig.game_type;
                        const putUpPattern = [
                            putUpFirstTeamId,
                            putUpFirstTeamId === teamA.id ? teamB.id : teamA.id
                        ];
                        const currentPutUpTeamId = putUpPattern[(setConfig.set_number - 1) % 2];
                        const currentPutUpTeamName = currentPutUpTeamId === teamA.id ? teamA.name : teamB.name;
                        const setStatus = set?.status || 'pending';
                        const scorerName = getProfileDisplayName(
                            set?.scorer || (
                                set?.scored_by_user_id === userId
                                    ? { full_name: 'You' }
                                    : null
                            )
                        );
                        const isOwnedByCurrentUser = !!set?.scored_by_user_id && set.scored_by_user_id === userId;
                        const isOwnedByOtherUser = !!set?.scored_by_user_id && set.scored_by_user_id !== userId;
                        const buttonLabel = isSubmissionLocked
                            ? 'Set Locked'
                            : set?.player_a_id && set?.player_b_id
                            ? (setStatus === 'completed' ? 'Review Set' : 'Continue Set')
                            : 'Select Players';
                        const displayedRace = set?.player_a_id && set?.player_b_id
                            ? {
                                p1: Number(set?.race_p1 || 0),
                                p2: Number(set?.race_p2 || 0)
                            }
                            : null;
                        const setActionDisabled = saving || isSubmissionLocked || isOwnedByOtherUser;
                        const canEditSet = setStatus !== 'completed' && !isSubmissionLocked;

                        return (
                            <View key={setConfig.set_number}>
                                {showSectionHeader ? (
                                    <Text className="text-primary font-bold text-lg mb-4 ml-1">
                                        {setConfig.game_type === '8ball' ? 'Match Sets - 8-Ball' : 'Match Sets - 9-Ball'}
                                    </Text>
                                ) : null}

                                <View className="bg-surface border border-border rounded-xl p-4 mb-3">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Text className="text-gray-300 font-bold uppercase tracking-wider text-xs">
                                            Set {setConfig.set_number} • {setConfig.game_type === '8ball' ? '8-Ball' : '9-Ball'}
                                        </Text>
                                        <Text className={`font-bold text-xs uppercase tracking-wider ${setStatus === 'completed' ? 'text-green-500' : setStatus === 'in_progress' ? 'text-blue-400' : 'text-primary'}`}>
                                            {setStatus}
                                        </Text>
                                    </View>

                                    <Text className="text-gray-400 text-sm mb-3 text-center">
                                        <Text className="text-white font-bold">{currentPutUpTeamName}</Text> puts up first for this set on your card.
                                    </Text>

                                    {set?.player_a_id && set?.player_b_id ? (
                                        <View className="flex-row justify-between items-center mb-3">
                                            <View className="flex-1 items-center">
                                                <Text className="text-white font-bold">
                                                    {teamAMembers.find((member) => member.player_id === set.player_a_id)?.profiles?.full_name || '?'}
                                                </Text>
                                                <Text className="text-gray-500 text-xs">Race {displayedRace?.p1 || '-'}</Text>
                                            </View>
                                            <View className="px-3">
                                                <Text className="text-gray-500 text-xs uppercase tracking-widest">vs</Text>
                                            </View>
                                            <View className="flex-1 items-center">
                                                <Text className="text-white font-bold">
                                                    {teamBMembers.find((member) => member.player_id === set.player_b_id)?.profiles?.full_name || '?'}
                                                </Text>
                                                <Text className="text-gray-500 text-xs">Race {displayedRace?.p2 || '-'}</Text>
                                            </View>
                                        </View>
                                    ) : null}

                                    {set?.scored_by_user_id && setStatus !== 'completed' ? (
                                        <Text className={`text-xs text-center mb-3 ${isOwnedByCurrentUser ? 'text-blue-300' : 'text-amber-300'}`}>
                                            {isOwnedByCurrentUser
                                                ? `You are scoring Set ${setConfig.set_number}`
                                                : `${scorerName} is scoring Set ${setConfig.set_number}`}
                                        </Text>
                                    ) : null}

                                    <TouchableOpacity
                                        className={`px-4 py-2 rounded-full items-center border ${isOwnedByOtherUser ? 'bg-amber-500/10 border-amber-500/40' : 'bg-primary/20 border-primary/50'} ${setActionDisabled ? 'opacity-60' : 'opacity-100'}`}
                                        disabled={setActionDisabled}
                                        onPress={() => {
                                            handleClaimSet(setConfig, set);
                                        }}
                                    >
                                        <Text className={`${isOwnedByOtherUser ? 'text-amber-300' : 'text-primary'} font-bold text-xs uppercase`}>
                                            {isOwnedByOtherUser ? `Waiting On ${scorerName}` : buttonLabel}
                                        </Text>
                                    </TouchableOpacity>

                                    {set?.id && isOwnedByCurrentUser && canEditSet ? (
                                        <TouchableOpacity
                                            className={`mt-3 px-4 py-2 rounded-full items-center border border-blue-500/40 ${saving ? 'opacity-40' : 'opacity-100'}`}
                                            disabled={saving}
                                            onPress={() => handleHandOffSet(set)}
                                        >
                                            <Text className="text-blue-300 font-bold text-xs uppercase">Generate Handoff Code</Text>
                                        </TouchableOpacity>
                                    ) : null}

                                    {set?.id && isOwnedByOtherUser && canEditSet ? (
                                        <TouchableOpacity
                                            className={`mt-3 px-4 py-2 rounded-full items-center border border-emerald-500/40 ${saving ? 'opacity-40' : 'opacity-100'}`}
                                            disabled={saving}
                                            onPress={() => {
                                                setClaimCodeModalSet(set);
                                                setClaimCodeValue("");
                                            }}
                                        >
                                            <Text className="text-emerald-300 font-bold text-xs uppercase">Enter Handoff Code</Text>
                                        </TouchableOpacity>
                                    ) : null}

                                    {set?.player_a_id && set?.player_b_id && isOwnedByCurrentUser && canEditSet ? (
                                        <TouchableOpacity
                                            className={`mt-3 px-4 py-2 rounded-full items-center border border-red-500/40 ${saving ? 'opacity-40' : 'opacity-100'}`}
                                            disabled={saving}
                                            onPress={() => handleResetSetLineup(set)}
                                        >
                                            <Text className="text-red-400 font-bold text-xs uppercase">Reset Set And Repick Players</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>
                        );
                    })
                )}

                {allSetsCompleted && canSubmitForVerification ? (
                    <TouchableOpacity
                        onPress={isWaitingForOpponentVerification || isVerified ? undefined : handleSubmitMatch}
                        disabled={saving || isWaitingForOpponentVerification || isVerified}
                        className={`mt-6 py-4 rounded-xl items-center ${saving ? 'bg-gray-700' : (isWaitingForOpponentVerification || isVerified) ? 'bg-surface border border-border' : 'bg-primary'}`}
                    >
                        {saving ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text className={`${(isWaitingForOpponentVerification || isVerified) ? 'text-gray-300' : 'text-black'} font-bold uppercase tracking-wider`}>
                                {isVerified
                                    ? 'Match Verified'
                                    : isWaitingForOpponentVerification
                                    ? `Waiting For Verification From ${oppTeamName}`
                                    : 'Submit Match For Verification'}
                            </Text>
                        )}
                    </TouchableOpacity>
                ) : null}

                {allSetsCompleted && !canSubmitForVerification ? (
                    <View className="mt-6 bg-surface border border-border rounded-xl p-4">
                        <Text className="text-white font-bold text-center mb-1">Captain Submission Required</Text>
                        <Text className="text-gray-400 text-center text-sm">
                            All 8 sets are done. A captain from your team can now submit this card for verification.
                        </Text>
                    </View>
                ) : null}
            </ScrollView>

            <Modal visible={!!selectedSet} transparent animationType="slide">
                <View className="flex-1 bg-black/80 justify-end">
                    <View className="bg-surface rounded-t-3xl pt-6 pb-10 px-4 border-t border-border">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white font-bold text-lg uppercase tracking-widest">
                                Set {selectedSet?.set_number} • {selectedSet?.game_type === '8ball' ? '8-Ball' : '9-Ball'}
                            </Text>
                            <TouchableOpacity onPress={() => { setSelectedSet(null); setPlayerAId(null); setPlayerBId(null); }}>
                                <FontAwesome5 name="times" size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-primary font-bold text-sm mb-1 uppercase">{teamA?.name} Player</Text>
                        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
                            BP CAP {currentTeamALevelSum}/27
                        </Text>
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {teamAMembers.map((member) => {
                                const isSelected = playerAId === member.player_id;
                                const isUsedInSameDiscipline = Object.values(submissionSets).some((set: any) =>
                                    set.set_number !== selectedSet?.set_number &&
                                    set.game_type === selectedSet?.game_type &&
                                    set.player_a_id === member.player_id
                                );
                                const currentLevelSum = calculateTeamLevelSum(true, member.player_id, selectedSet?.game_type);
                                const exceedsCap = !isSelected && currentLevelSum > 27.0;
                                const isDisabled = !isSelected && (exceedsCap || isUsedInSameDiscipline);

                                return (
                                    <TouchableOpacity
                                        key={member.id}
                                        onPress={() => {
                                            if (isUsedInSameDiscipline) {
                                                Alert.alert("Already Used", `${member.profiles?.full_name} has already played a ${selectedSet?.game_type === '8ball' ? '8-Ball' : '9-Ball'} set in this match.`);
                                                return;
                                            }
                                            if (exceedsCap) {
                                                Alert.alert("Cap Exceeded", `Adding ${member.profiles?.full_name} puts your team's Breakpoint Level at ${currentLevelSum}, which exceeds the maximum of 27.0.`);
                                                return;
                                            }
                                            setPlayerAId(member.player_id);
                                        }}
                                        disabled={isDisabled}
                                        className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-primary border-primary' : 'bg-black/40 border-border'} ${isDisabled ? 'opacity-30' : 'opacity-100'}`}
                                    >
                                        <Text className={`font-bold ${isSelected ? 'text-black' : 'text-gray-300'}`}>
                                            {member.profiles?.full_name} <Text className={`font-normal ${isSelected ? 'text-black' : 'text-gray-400'}`}>({getBreakpointLevel(member.profiles?.breakpoint_rating)})</Text>
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text className="text-primary font-bold text-sm mb-1 uppercase">{teamB?.name} Player</Text>
                        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
                            BP CAP {currentTeamBLevelSum}/27
                        </Text>
                        <View className="flex-row flex-wrap gap-2 mb-8">
                            {teamBMembers.map((member) => {
                                const isSelected = playerBId === member.player_id;
                                const isUsedInSameDiscipline = Object.values(submissionSets).some((set: any) =>
                                    set.set_number !== selectedSet?.set_number &&
                                    set.game_type === selectedSet?.game_type &&
                                    set.player_b_id === member.player_id
                                );
                                const currentLevelSum = calculateTeamLevelSum(false, member.player_id, selectedSet?.game_type);
                                const exceedsCap = !isSelected && currentLevelSum > 27.0;
                                const isDisabled = !isSelected && (exceedsCap || isUsedInSameDiscipline);

                                return (
                                    <TouchableOpacity
                                        key={member.id}
                                        onPress={() => {
                                            if (isUsedInSameDiscipline) {
                                                Alert.alert("Already Used", `${member.profiles?.full_name} has already played a ${selectedSet?.game_type === '8ball' ? '8-Ball' : '9-Ball'} set in this match.`);
                                                return;
                                            }
                                            if (exceedsCap) {
                                                Alert.alert("Cap Exceeded", `Adding ${member.profiles?.full_name} puts your team's Breakpoint Level at ${currentLevelSum}, which exceeds the maximum of 27.0.`);
                                                return;
                                            }
                                            setPlayerBId(member.player_id);
                                        }}
                                        disabled={isDisabled}
                                        className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-primary border-primary' : 'bg-black/40 border-border'} ${isDisabled ? 'opacity-30' : 'opacity-100'}`}
                                    >
                                        <Text className={`font-bold ${isSelected ? 'text-black' : 'text-gray-300'}`}>
                                            {member.profiles?.full_name} <Text className={`font-normal ${isSelected ? 'text-black' : 'text-gray-400'}`}>({getBreakpointLevel(member.profiles?.breakpoint_rating)})</Text>
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            onPress={handleSaveLineup}
                            disabled={!playerAId || !playerBId || saving}
                            className={`bg-primary py-4 rounded-full items-center ${(!playerAId || !playerBId || saving) ? 'opacity-50' : 'opacity-100'}`}
                        >
                            {saving ? <ActivityIndicator color="#000" /> : <Text className="text-black font-bold uppercase tracking-wider">Save And Open Set</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!pendingCoinFlipTeamId} transparent animationType="fade">
                <View className="flex-1 bg-black/80 justify-center px-6">
                    <View className="bg-surface rounded-2xl p-6 border border-border">
                        <Text className="text-white font-bold text-lg mb-3 text-center">Save Coin Flip</Text>
                        <Text className="text-gray-300 text-center text-sm leading-5 mb-6">
                            Record that{" "}
                            <Text className="text-white font-bold">
                                {pendingCoinFlipTeamId === teamA?.id ? teamA?.name : teamB?.name}
                            </Text>{" "}
                            puts up first for Set 1 on your scorecard.
                        </Text>
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                className={`flex-1 bg-background border border-border rounded-lg p-3 items-center ${saving ? 'opacity-50' : 'opacity-100'}`}
                                disabled={saving}
                                onPress={() => setPendingCoinFlipTeamId(null)}
                            >
                                <Text className="text-gray-300 font-bold uppercase text-xs">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`flex-1 bg-primary rounded-lg p-3 items-center ${saving ? 'opacity-60' : 'opacity-100'}`}
                                disabled={saving}
                                onPress={handleSaveCoinFlip}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <Text className="text-black font-bold uppercase text-xs">Confirm</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!handoffCodeModalSet} transparent animationType="fade">
                <View className="flex-1 bg-black/80 justify-center px-6">
                    <View className="bg-surface rounded-2xl p-6 border border-border">
                        <Text className="text-white font-bold text-lg mb-2 text-center">Handoff Code</Text>
                        <Text className="text-gray-300 text-center text-sm leading-5 mb-5">
                            Have the other phone enter this code to take over Set {handoffCodeModalSet?.set_number}.
                        </Text>
                        <View className="bg-background border border-blue-500/40 rounded-xl py-4 mb-5 items-center">
                            <Text className="text-blue-300 text-3xl font-bold tracking-[8px]">{handoffCodeValue}</Text>
                        </View>
                        <TouchableOpacity
                            className="bg-primary rounded-lg p-3 items-center"
                            onPress={() => {
                                setHandoffCodeModalSet(null);
                                setHandoffCodeValue("");
                                fetchScreenData({ silent: true });
                            }}
                        >
                            <Text className="text-black font-bold uppercase text-xs">Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!claimCodeModalSet} transparent animationType="fade">
                <View className="flex-1 bg-black/80 justify-center px-6">
                    <View className="bg-surface rounded-2xl p-6 border border-border">
                        <Text className="text-white font-bold text-lg mb-2 text-center">Enter Handoff Code</Text>
                        <Text className="text-gray-300 text-center text-sm leading-5 mb-5">
                            Enter the code from the phone currently scoring Set {claimCodeModalSet?.set_number}.
                        </Text>
                        <TextInput
                            value={claimCodeValue}
                            onChangeText={(value) => setClaimCodeValue(value.replace(/[^0-9]/g, '').slice(0, 4))}
                            keyboardType="number-pad"
                            placeholder="0000"
                            placeholderTextColor="#6B7280"
                            className="bg-background border border-border rounded-xl px-4 py-4 text-white text-center text-2xl font-bold tracking-[8px] mb-5"
                            maxLength={4}
                        />
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                className="flex-1 bg-background border border-border rounded-lg p-3 items-center"
                                onPress={() => {
                                    setClaimCodeModalSet(null);
                                    setClaimCodeValue("");
                                }}
                            >
                                <Text className="text-gray-300 font-bold uppercase text-xs">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`flex-1 bg-primary rounded-lg p-3 items-center ${saving ? 'opacity-60' : 'opacity-100'}`}
                                disabled={saving}
                                onPress={handleClaimWithCode}
                            >
                                {saving ? <ActivityIndicator color="#000" /> : <Text className="text-black font-bold uppercase text-xs">Take Over</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
