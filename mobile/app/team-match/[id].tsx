import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Modal, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5 } from '@expo/vector-icons';
import { getBreakpointLevel } from "../../utils/rating";
import { useSession } from "../../lib/SessionContext";

export default function TeamMatchScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { getToken, userId } = useAuth();
    const { user } = useUser();
    const { currentSession } = useSession();

    const [loading, setLoading] = useState(true);
    const [match, setMatch] = useState<any>(null);
    const [sets, setSets] = useState<any[]>([]);
    
    const [teamA, setTeamA] = useState<any>(null);
    const [teamB, setTeamB] = useState<any>(null);
    const [teamAMembers, setTeamAMembers] = useState<any[]>([]);
    const [teamBMembers, setTeamBMembers] = useState<any[]>([]);

    const [userTeamId, setUserTeamId] = useState<string | null>(null);

    // Modal State
    const [selectedSet, setSelectedSet] = useState<any>(null);
    const [playerAId, setPlayerAId] = useState<string | null>(null);
    const [playerBId, setPlayerBId] = useState<string | null>(null);
    const [isStartingSet, setIsStartingSet] = useState(false);

    const isCaptain = (teamId: string) => {
        if (teamId === teamA?.id && teamA?.captain_id === userId) return true;
        if (teamId === teamB?.id && teamB?.captain_id === userId) return true;
        return false;
    };

    const fetchMatchDetails = useCallback(async () => {
        if (!userId || !id) return;
        setLoading(true);

        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            // Fetch Match
            const { data: matchData, error: matchError } = await supabase
                .from('team_matches')
                .select('*, team_a:team_a_id(*), team_b:team_b_id(*)')
                .eq('id', id)
                .single();

            if (matchError) throw matchError;

            // Figure out My Team
            const { data: myTeamData } = await supabase
                .from('team_members')
                .select('team_id')
                .eq('player_id', userId)
                .in('team_id', [matchData.team_a_id, matchData.team_b_id])
                .maybeSingle();

            if (myTeamData) setUserTeamId(myTeamData.team_id);
            else if (matchData.team_a.captain_id === userId) setUserTeamId(matchData.team_a.id);
            else if (matchData.team_b.captain_id === userId) setUserTeamId(matchData.team_b.id);

            setMatch(matchData);
            setTeamA(matchData.team_a);
            setTeamB(matchData.team_b);

            // Fetch Members for A
            const { data: membersA } = await supabase
                .from('team_members')
                .select('*, profiles(*)')
                .eq('team_id', matchData.team_a_id);
            setTeamAMembers(membersA || []);

            // Fetch Members for B
            const { data: membersB } = await supabase
                .from('team_members')
                .select('*, profiles(*)')
                .eq('team_id', matchData.team_b_id);
            setTeamBMembers(membersB || []);

            // Fetch Sets
            const { data: setsData } = await supabase
                .from('team_match_sets')
                .select('*, player_a:player_a_id(*), player_b:player_b_id(*), matches(*)')
                .eq('team_match_id', id)
                .order('set_number', { ascending: true });
            
            // If sets don't exist yet, we can initialize them when the coin flip happens, 
            // or just generate 8 empty sets on DB creation. Assuming they aren't generated yet.
            if (!setsData || setsData.length === 0) {
                // Generate the 8 sets structure in state, not DB
                const emptySets = Array.from({length: 8}, (_, i) => ({
                    set_number: i + 1,
                    game_type: i < 4 ? '8ball' : '9ball',
                    player_a_id: null,
                    player_b_id: null,
                    put_up_team_id: null,
                    winner_team_id: null,
                    match_id: null
                }));
                setSets(emptySets);
            } else {
                setSets(setsData);
            }

        } catch (e) {
            console.error("Fetch Match Error", e);
            Alert.alert("Error", "Failed to load match details.");
        } finally {
            setLoading(false);
        }
    }, [id, userId, getToken]);

    useFocusEffect(
        useCallback(() => {
            fetchMatchDetails();
        }, [fetchMatchDetails])
    );

    const handleCoinFlipDecision = async (decidingTeamId: string) => {
        // Only a captain from either team can log the coin flip
        if (!isCaptain(teamA.id) && !isCaptain(teamB.id)) {
            Alert.alert("Captains Only", "Only team captains can log the coin flip result.");
            return;
        }

        try {
            setLoading(true);
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            // Set the put_up_first_team_id
            const { error } = await supabase
                .from('team_matches')
                .update({ put_up_first_team_id: decidingTeamId, status: 'in_progress' })
                .eq('id', match.id);

            if (error) throw error;
            fetchMatchDetails();
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to save coin flip result.");
            setLoading(false);
        }
    };

    const handleStartSet = async () => {
        if (!selectedSet || !playerAId || !playerBId) {
            Alert.alert("Error", "Please select a player from both teams.");
            return;
        }

        setIsStartingSet(true);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            // 1. Create standard `matches` row
            const { data: newMatch, error: matchError } = await supabase
                .from('matches')
                .insert({
                    league_id: currentSession?.id,
                    player1_id: playerAId,
                    player2_id: playerBId,
                    week_number: match.week_number,
                    is_team_match_set: true, // Hide from individual matches view
                    status: 'scheduled'
                })
                .select()
                .single();

            if (matchError) throw matchError;

            // 2. Create or Update `team_match_sets` row
            const putUpPattern = [match.put_up_first_team_id, match.put_up_first_team_id === teamA.id ? teamB.id : teamA.id];
            const currentPutUpId = putUpPattern[(selectedSet.set_number - 1) % 2];

            if (selectedSet.id) {
                // Update
                const { error: setError } = await supabase
                    .from('team_match_sets')
                    .update({
                        player_a_id: playerAId,
                        player_b_id: playerBId,
                        put_up_team_id: currentPutUpId,
                        match_id: newMatch.id
                    })
                    .eq('id', selectedSet.id);
                if (setError) throw setError;
            } else {
                // Insert
                const { error: setError } = await supabase
                    .from('team_match_sets')
                    .insert({
                        team_match_id: match.id,
                        set_number: selectedSet.set_number,
                        game_type: selectedSet.game_type,
                        player_a_id: playerAId,
                        player_b_id: playerBId,
                        put_up_team_id: currentPutUpId,
                        match_id: newMatch.id
                    });
                if (setError) throw setError;
            }

            setSelectedSet(null);
            setPlayerAId(null);
            setPlayerBId(null);
            
            // Navigate directly to the match scoring
            router.push(`/match/${newMatch.id}`);

        } catch(e) {
            console.error("Start Set Error:", e);
            Alert.alert("Error", "Failed to start set.");
        } finally {
            setIsStartingSet(false);
        }
    };

    if (loading && !match) {
        return (
            <SafeAreaView className="flex-1 bg-background justify-center items-center">
                <ActivityIndicator color="#D4AF37" size="large" />
            </SafeAreaView>
        );
    }

    if (!match) return null;

    const myWins = userTeamId === teamA?.id ? match.wins_a : (userTeamId === teamB?.id ? match.wins_b : match.wins_a);
    const opponentWins = userTeamId === teamA?.id ? match.wins_b : (userTeamId === teamB?.id ? match.wins_a : match.wins_b);
    const myTeamName = userTeamId === teamA?.id ? teamA?.name : (userTeamId === teamB?.id ? teamB?.name : teamA?.name);
    const oppTeamName = userTeamId === teamA?.id ? teamB?.name : (userTeamId === teamB?.id ? teamA?.name : teamB?.name);

    // Calculate sum of unique active players for a specific team
    const calculateTeamLevelSum = (isTeamA: boolean, pendingPlayerId: string | null) => {
        const activeIds = new Set<string>();
        if (pendingPlayerId) activeIds.add(pendingPlayerId);
        
        sets.forEach(set => {
            if (isTeamA && set.player_a_id) activeIds.add(set.player_a_id);
            if (!isTeamA && set.player_b_id) activeIds.add(set.player_b_id);
        });
        
        let sum = 0;
        const membersToUse = isTeamA ? teamAMembers : teamBMembers;
        activeIds.forEach(id => {
            const member = membersToUse.find(m => m.player_id === id);
            if (member && member.profiles?.breakpoint_rating) {
                sum += parseFloat(getBreakpointLevel(member.profiles.breakpoint_rating));
            } else if (member) {
                sum += 5.0; // Default rating assumption if missing
            }
        });
        
        return Number(sum.toFixed(1));
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
             <View className="px-4 py-4 border-b border-border/50 bg-surface/30 flex-row items-center justify-between">
                 <TouchableOpacity onPress={() => router.back()} className="p-2">
                     <FontAwesome5 name="chevron-left" size={20} color="#D4AF37" />
                 </TouchableOpacity>
                 <View className="items-center flex-1">
                    <Text className="text-white text-base font-bold uppercase tracking-widest text-center" numberOfLines={1}>Week {match.week_number} Matchup</Text>
                 </View>
                 <View className="w-10" />
             </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                {/* Scoreboard */}
                <View className="bg-surface border border-border rounded-xl p-4 mb-6">
                    <View className="flex-row justify-between items-center">
                        <View className="flex-1 items-center">
                            <Text className="text-white font-bold text-center mb-1" numberOfLines={1}>{myTeamName}</Text>
                            <Text className="text-primary font-bold text-3xl">{myWins}</Text>
                        </View>
                        <View className="px-4 justify-center items-center">
                            <Text className="text-gray-500 font-bold text-sm tracking-widest uppercase mb-1">Score</Text>
                            <Text className="text-gray-600 text-xs">Best of 8</Text>
                        </View>
                        <View className="flex-1 items-center">
                            <Text className="text-gray-300 font-bold text-center mb-1" numberOfLines={1}>{oppTeamName}</Text>
                            <Text className="text-gray-400 font-bold text-3xl">{opponentWins}</Text>
                        </View>
                    </View>
                </View>

                {/* Match Flow */}
                {!match.put_up_first_team_id ? (
                    <View className="bg-primary/10 border border-primary/30 rounded-xl p-6 items-center">
                        <View className="bg-surface w-16 h-16 rounded-full items-center justify-center border border-primary/50 mb-4">
                            <FontAwesome5 name="coins" size={28} color="#D4AF37" />
                        </View>
                        <Text className="text-white font-bold text-lg mb-2">Coin Flip Needed</Text>
                        <Text className="text-gray-400 text-center text-sm mb-6 leading-5">
                            Captains, flip a physical coin. The winner of the coin flip decides which team will "put up" their player first for Set 1.
                        </Text>
                        <Text className="text-gray-300 font-bold uppercase text-xs mb-3">Which team puts up first?</Text>
                        <View className="flex-row gap-3 w-full">
                            <TouchableOpacity 
                                className="flex-1 bg-surface border border-border rounded-lg p-3 items-center"
                                onPress={() => handleCoinFlipDecision(teamA.id)}
                            >
                                <Text className="text-white font-bold text-center" numberOfLines={2}>{teamA.name}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                className="flex-1 bg-surface border border-border rounded-lg p-3 items-center"
                                onPress={() => handleCoinFlipDecision(teamB.id)}
                            >
                                <Text className="text-white font-bold text-center" numberOfLines={2}>{teamB.name}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View>
                        <Text className="text-white font-bold text-lg mb-4 ml-1">Match Sets</Text>
                        {sets.map((set, index) => {
                            // Calculate who puts up based on Set Number and initial coin flip
                            // Rotation: If team_a put up first in set 1, team_b puts up first in set 2.
                            const putUpPattern = [
                                match.put_up_first_team_id,
                                match.put_up_first_team_id === teamA.id ? teamB.id : teamA.id
                            ];
                            const currentSetPutUpTeamId = putUpPattern[(set.set_number - 1) % 2];
                            const currentPutUpTeamName = currentSetPutUpTeamId === teamA.id ? teamA.name : teamB.name;

                            return (
                                <View key={index} className="bg-surface border border-border rounded-xl p-4 mb-3">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Text className="text-gray-300 font-bold uppercase tracking-wider text-xs">Set {set.set_number} • {set.game_type === '8ball' ? '8-Ball' : '9-Ball'}</Text>
                                        {set.winner_team_id ? (
                                             <Text className="text-green-500 font-bold text-xs uppercase tracking-wider">Completed</Text>
                                        ) : (
                                            <Text className="text-primary font-bold text-xs uppercase tracking-wider">Pending</Text>
                                        )}
                                    </View>
                                    
                                    {!set.id ? (
                                        // Set hasn't been created/initialized yet
                                        <View className="mt-2 items-center">
                                            <Text className="text-gray-400 text-sm mb-3 text-center">
                                                <Text className="text-white font-bold">{currentPutUpTeamName}</Text> puts up first.
                                            </Text>
                                            <TouchableOpacity 
                                                className="bg-primary/20 border border-primary/50 px-4 py-2 rounded-full"
                                                onPress={() => setSelectedSet(set)}
                                            >
                                                <Text className="text-primary font-bold text-xs uppercase">Select Players</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        // Set is created
                                        <View className="flex-row justify-between items-center mt-2">
                                            <View className="flex-1 items-center">
                                                 <Text className="text-white font-bold">{set.player_a?.full_name || '?'}</Text>
                                            </View>
                                            
                                            <TouchableOpacity 
                                                className="bg-primary/20 border border-primary/50 px-4 py-1.5 rounded-full"
                                                onPress={() => router.push(`/match/${set.match_id}`)}
                                            >
                                                <Text className="text-primary font-bold text-xs uppercase">View Score</Text>
                                            </TouchableOpacity>

                                            <View className="flex-1 items-center">
                                                 <Text className="text-white font-bold">{set.player_b?.full_name || '?'}</Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Select Players Modal */}
            <Modal
                visible={!!selectedSet}
                transparent={true}
                animationType="slide"
            >
                <View className="flex-1 bg-black/80 justify-end">
                    <View className="bg-surface rounded-t-3xl pt-6 pb-10 px-4 border-t border-border">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-white font-bold text-lg uppercase tracking-widest">
                                Set {selectedSet?.set_number} • {selectedSet?.game_type === '8ball' ? '8-Ball' : '9-Ball'}
                            </Text>
                            <TouchableOpacity onPress={() => { setSelectedSet(null); setPlayerAId(null); setPlayerBId(null); }}>
                                <FontAwesome5 name="times" size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        {/* Team A Selection */}
                        <Text className="text-primary font-bold text-sm mb-2 uppercase">{teamA.name} Player</Text>
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {teamAMembers.map(m => {
                                const isSelected = playerAId === m.player_id;
                                const currentLevelSum = calculateTeamLevelSum(true, m.player_id);
                                const exceedsCap = !isSelected && currentLevelSum > 25.0;

                                return (
                                    <TouchableOpacity 
                                        key={m.id}
                                        onPress={() => {
                                            if (exceedsCap) {
                                                Alert.alert("Cap Exceeded", `Adding ${m.profiles?.full_name} puts your team's Breakpoint Level at ${currentLevelSum}, which exceeds the maximum of 25.0.`);
                                                return;
                                            }
                                            setPlayerAId(m.player_id);
                                        }}
                                        className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-primary border-primary' : 'bg-black/40 border-border'} ${exceedsCap ? 'opacity-30' : 'opacity-100'}`}
                                    >
                                        <Text className={`font-bold ${isSelected ? 'text-black' : 'text-gray-300'}`}>
                                            {m.profiles?.full_name} <Text className={`font-normal ${isSelected ? 'text-black' : 'text-gray-400'}`}>({getBreakpointLevel(m.profiles?.breakpoint_rating)})</Text>
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Team B Selection */}
                        <Text className="text-primary font-bold text-sm mb-2 uppercase">{teamB.name} Player</Text>
                        <View className="flex-row flex-wrap gap-2 mb-8">
                            {teamBMembers.map(m => {
                                const isSelected = playerBId === m.player_id;
                                const currentLevelSum = calculateTeamLevelSum(false, m.player_id);
                                const exceedsCap = !isSelected && currentLevelSum > 25.0;

                                return (
                                    <TouchableOpacity 
                                        key={m.id}
                                        onPress={() => {
                                            if (exceedsCap) {
                                                Alert.alert("Cap Exceeded", `Adding ${m.profiles?.full_name} puts your team's Breakpoint Level at ${currentLevelSum}, which exceeds the maximum of 25.0.`);
                                                return;
                                            }
                                            setPlayerBId(m.player_id);
                                        }}
                                        className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-primary border-primary' : 'bg-black/40 border-border'} ${exceedsCap ? 'opacity-30' : 'opacity-100'}`}
                                    >
                                        <Text className={`font-bold ${isSelected ? 'text-black' : 'text-gray-300'}`}>
                                            {m.profiles?.full_name} <Text className={`font-normal ${isSelected ? 'text-black' : 'text-gray-400'}`}>({getBreakpointLevel(m.profiles?.breakpoint_rating)})</Text>
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity 
                            onPress={handleStartSet}
                            disabled={!playerAId || !playerBId || isStartingSet}
                            className={`bg-primary py-4 rounded-full items-center ${(!playerAId || !playerBId || isStartingSet) ? 'opacity-50' : 'opacity-100'}`}
                        >
                            {isStartingSet ? <ActivityIndicator color="#000" /> : <Text className="text-black font-bold uppercase tracking-wider">Start Set</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
