import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { createClient } from "@supabase/supabase-js";
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSession } from "../../lib/SessionContext";
import { supabase } from "../../lib/supabase";
import { applyRealtimeAuth } from "../../lib/realtimeAuth";
import { getBreakpointLevel } from "../../utils/rating";

function getPlayerNameLines(fullName?: string | null) {
    const trimmedName = fullName?.trim();
    if (!trimmedName) {
        return { firstLine: "Player", secondLine: "" };
    }

    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return { firstLine: parts[0], secondLine: "" };
    }

    return {
        firstLine: parts[0],
        secondLine: parts.slice(1).join(" "),
    };
}

function formatBreakpointSum(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getTeamBreakpointRangeLabel(members: any[]) {
    if (!members.length) return null;

    const levels = members
        .map((member) => parseFloat(getBreakpointLevel(member?.profiles?.breakpoint_rating)))
        .filter((level) => Number.isFinite(level))
        .sort((a, b) => a - b);

    if (!levels.length) return null;

    const groupSize = Math.min(4, levels.length);
    const lowTotal = levels.slice(0, groupSize).reduce((sum, level) => sum + level, 0);
    const highTotal = levels.slice(-groupSize).reduce((sum, level) => sum + level, 0);

    return `BP Range ${formatBreakpointSum(lowTotal)}-${formatBreakpointSum(highTotal)}`;
}

function getTeamMemberConflictMessage(error: unknown) {
    const parts: string[] = [];

    if (error instanceof Error) {
        parts.push(error.message);
    }

    if (error && typeof error === "object") {
        const maybeError = error as { message?: string; details?: string; hint?: string; code?: string };
        if (maybeError.message) parts.push(maybeError.message);
        if (maybeError.details) parts.push(maybeError.details);
        if (maybeError.hint) parts.push(maybeError.hint);
        if (maybeError.code) parts.push(maybeError.code);
    }

    const combined = parts.join(" ").toLowerCase();
    if (
        combined.includes("already belongs to another team in this league") ||
        combined.includes("already on a roster") ||
        combined.includes("duplicate key") ||
        combined.includes("23505")
    ) {
        return "That player is already on a roster for this league.";
    }

    return "Failed to add player to team.";
}

function isTeamMemberConflict(error: unknown) {
    const parts: string[] = [];

    if (error instanceof Error) {
        parts.push(error.message);
    }

    if (error && typeof error === "object") {
        const maybeError = error as { message?: string; details?: string; hint?: string; code?: string };
        if (maybeError.message) parts.push(maybeError.message);
        if (maybeError.details) parts.push(maybeError.details);
        if (maybeError.hint) parts.push(maybeError.hint);
        if (maybeError.code) parts.push(maybeError.code);
    }

    const combined = parts.join(" ").toLowerCase();
    return (
        combined.includes("already belongs to another team in this league") ||
        combined.includes("already on a roster") ||
        combined.includes("duplicate key") ||
        combined.includes("23505") ||
        combined.includes("p0001")
    );
}

export default function ManageTeamScreen() {
    const { getToken, userId } = useAuth();
    const router = useRouter();
    const { currentSession } = useSession();
    const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [loading, setLoading] = useState(true);
    const [team, setTeam] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    
    // Add Player State
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
    const [addLoading, setAddLoading] = useState(false);

    // Edit Team Name State
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState("");
    const [renameLoading, setRenameLoading] = useState(false);
    
    // Submit Team State
    const [submitLoading, setSubmitLoading] = useState(false);

    const fetchTeamData = useCallback(async () => {
        if (!currentSession?.id || !userId) return;
        // Don't set loading to true here to avoid UI flashing if re-fetched
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            // Fetch Team
            const { data: captainTeam, error: captainError } = await supabase
                .from('teams')
                .select('*')
                .eq('league_id', currentSession.id)
                .eq('captain_id', userId)
                .maybeSingle();

            if (captainError && captainError.code !== 'PGRST116') {
                console.error("Error fetching captain team:", captainError);
                return;
            }

            let teamData = captainTeam;

            if (!teamData) {
                const { data: memberTeamData, error: memberTeamError } = await supabase
                    .from('team_members')
                    .select('teams!inner(*)')
                    .eq('player_id', userId)
                    .eq('teams.league_id', currentSession.id)
                    .maybeSingle();

                if (memberTeamError && memberTeamError.code !== 'PGRST116') {
                    console.error("Error fetching member team:", memberTeamError);
                    return;
                }

                const memberTeam = memberTeamData?.teams;
                if (memberTeam && !Array.isArray(memberTeam)) {
                    teamData = memberTeam;
                }
            }

            if (teamData) {
                setTeam(teamData);
                // Fetch Members
                const { data: membersData, error: memError } = await supabase
                    .from('team_members')
                    .select('*, profiles(id, full_name, nickname, breakpoint_rating, avatar_url, player_number)')
                    .eq('team_id', teamData.id)
                    .order('joined_at', { ascending: true });

                if (!memError && membersData) {
                    setMembers(membersData);
                    
                    // Fetch Available Players (Enrolled but not on ANY team)
                    const { data: takenMembers } = await supabase
                        .from('team_members')
                        .select('player_id, teams!inner(league_id)')
                        .eq('teams.league_id', currentSession.id);
                    
                    const takenIds = takenMembers?.map(m => m.player_id) || [];
                    
                    const { data: available } = await supabase
                        .from('league_players')
                        .select('player_id, profiles!inner(id, full_name, nickname, breakpoint_rating, avatar_url, player_number)')
                        .eq('league_id', currentSession.id);

                    if (available) {
                        const filtered = available
                            .filter(ap => !takenIds.includes(ap.player_id))
                            .map(ap => ap.profiles);
                        setAvailablePlayers(filtered as any[]);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [currentSession?.id, userId]); // Removed getToken as it can trigger infinite renders in Clerk

    useFocusEffect(useCallback(() => {
        fetchTeamData();

        const interval = setInterval(() => {
            fetchTeamData();
        }, 5000);

        return () => clearInterval(interval);
    }, [fetchTeamData]));

    useEffect(() => {
        if (!currentSession?.id || !userId) return;

        let isActive = true;
        let channel: ReturnType<typeof supabase.channel> | null = null;

        const scheduleRefresh = () => {
            if (realtimeRefreshTimeoutRef.current) {
                clearTimeout(realtimeRefreshTimeoutRef.current);
            }

            realtimeRefreshTimeoutRef.current = setTimeout(() => {
                fetchTeamData();
            }, 250);
        };

        (async () => {
            try {
                const token = await getToken({ template: 'supabase' });
                if (!isActive) return;

                await applyRealtimeAuth(token);
                if (!isActive) return;

                channel = supabase
                    .channel(`team-roster:${currentSession.id}:${userId}`)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'team_members',
                    }, scheduleRefresh)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'teams',
                        filter: `league_id=eq.${currentSession.id}`,
                    }, scheduleRefresh)
                    .subscribe();
            } catch (error) {
                console.warn('ManageTeamScreen realtime setup failed:', error);
            }
        })();

        return () => {
            isActive = false;

            if (realtimeRefreshTimeoutRef.current) {
                clearTimeout(realtimeRefreshTimeoutRef.current);
                realtimeRefreshTimeoutRef.current = null;
            }

            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [currentSession?.id, userId, getToken, fetchTeamData]);



    const handleAddPlayer = async (player: any) => {
        if (!player || !team) return;

        if (members.length >= 6) {
            Alert.alert("Roster Full", "Your team already has the maximum of 6 players.");
            return;
        }

        Alert.alert(
            "Add Player",
            `Are you sure you want to add ${player.full_name || 'this player'} to your team?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Add Player",
                    onPress: async () => {
                        setAddLoading(true);
                        try {
                            const token = await getToken({ template: 'supabase' });
                            const supabase = createClient(
                                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                                { global: { headers: { Authorization: `Bearer ${token}` } } }
                            );

                            const { error } = await supabase
                                .from('team_members')
                                .insert({
                                    team_id: team.id,
                                    player_id: player.id
                                });

                            if (error) throw error;

                            Alert.alert("Success", `${player.full_name || 'Player'} added to team!`);
                            fetchTeamData(); // Refresh Roster & Available Players

                        } catch (e) {
                            if (!isTeamMemberConflict(e)) {
                                console.error(e);
                            }
                            await fetchTeamData();
                            Alert.alert("Player unavailable", getTeamMemberConflictMessage(e));
                        } finally {
                            setAddLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleRemovePlayer = (member: any) => {
        if (member.player_id === userId) {
            Alert.alert("Error", "You cannot remove yourself as the Captain.");
            return;
        }

        Alert.alert(
            "Remove Player",
            `Are you sure you want to remove ${member.profiles?.full_name || 'this player'}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const token = await getToken({ template: 'supabase' });
                            const supabase = createClient(
                                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                                { global: { headers: { Authorization: `Bearer ${token}` } } }
                            );

                            const { error } = await supabase
                                .from('team_members')
                                .delete()
                                .eq('id', member.id);

                            if (error) throw error;
                            fetchTeamData();
                        } catch (e) {
                            console.error(e);
                            Alert.alert("Error", "Failed to remove player.");
                        }
                    }
                }
            ]
        );
    };

    const handleRenameTeam = async () => {
        if (!newName.trim() || newName.trim() === team.name) {
            setIsEditingName(false);
            return;
        }

        setRenameLoading(true);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            const { error } = await supabase
                .from('teams')
                .update({ name: newName.trim() })
                .eq('id', team.id);

            if (error) {
                throw error;
            }
            setIsEditingName(false);
            fetchTeamData();
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to rename team.");
        } finally {
            setRenameLoading(false);
        }
    };

    const handleSubmitTeam = async () => {
        if (!team || members.length < 6) return;
        
        Alert.alert(
            "Submit Roster",
            "Are you ready to submit this roster for operator approval? You won't be able to play until it's approved.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Submit",
                    onPress: async () => {
                        setSubmitLoading(true);
                        try {
                            const token = await getToken({ template: 'supabase' });
                            const supabase = createClient(
                                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                                { global: { headers: { Authorization: `Bearer ${token}` } } }
                            );

                            const { error } = await supabase
                                .from('teams')
                                .update({ status: 'submitted' })
                                .eq('id', team.id);

                            if (error) throw error;
                            
                            Alert.alert("Success", "Team roster submitted for approval!");
                            fetchTeamData();
                        } catch (e) {
                            console.error(e);
                            Alert.alert("Error", "Failed to submit team.");
                        } finally {
                            setSubmitLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleRequestEdit = async () => {
        if (!team) return;
        
        Alert.alert(
            "Request Roster Edit",
            "This will send a request to the operator to allow you to edit your team roster. Your team will remain locked until they approve.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Send Request",
                    onPress: async () => {
                        setSubmitLoading(true);
                        try {
                            const token = await getToken({ template: 'supabase' });
                            const supabase = createClient(
                                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                                { global: { headers: { Authorization: `Bearer ${token}` } } }
                            );

                            const { error } = await supabase
                                .from('teams')
                                .update({ status: 'edit_requested' })
                                .eq('id', team.id);

                            if (error) throw error;
                            
                            Alert.alert("Success", "Edit request sent to operator!");
                            fetchTeamData();
                        } catch (e) {
                            console.error(e);
                            Alert.alert("Error", "Failed to send request.");
                        } finally {
                            setSubmitLoading(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-background justify-center items-center">
                <ActivityIndicator color="#D4AF37" size="large" />
            </SafeAreaView>
        );
    }

    if (!team) {
        return (
            <SafeAreaView className="flex-1 bg-background p-4 justify-center items-center">
                 <Text className="text-white text-xl font-bold mb-4">No Team Found</Text>
                 <Text className="text-gray-400 text-center mb-6">You are not a captain of any team in this session.</Text>
                 <TouchableOpacity onPress={() => router.back()} className="bg-surface px-6 py-3 rounded-full border border-border">
                     <Text className="text-white font-bold">Go Back</Text>
                 </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const isCaptain = team.captain_id === userId;
    const teamBreakpointRangeLabel = getTeamBreakpointRangeLabel(members);
    const isRosterEditable = !team.status;
    const teamStatusText = isRosterEditable ? "Roster editable" : team.status?.replace('_', ' ');

    return (
        <SafeAreaView className="flex-1 bg-background">
             <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
                 <View className="px-4 py-4 border-b border-border/50 bg-surface/30 flex-row items-center justify-between">
                     <TouchableOpacity onPress={() => router.back()} className="p-2">
                         <FontAwesome5 name="chevron-left" size={20} color="#D4AF37" />
                     </TouchableOpacity>
                     <View className="items-center flex-1">
                        {isEditingName ? (
                            <View className="flex-row items-center">
                                <TextInput
                                    className="text-white text-lg font-bold uppercase tracking-widest border-b border-primary min-w-[150px] text-center"
                                    value={newName}
                                    onChangeText={setNewName}
                                    autoFocus
                                    onBlur={() => setIsEditingName(false)}
                                    onSubmitEditing={handleRenameTeam}
                                />
                                {renameLoading ? (
                                    <ActivityIndicator size="small" color="#D4AF37" className="ml-2" />
                                ) : (
                                    <TouchableOpacity onPress={handleRenameTeam} className="ml-2">
                                        <FontAwesome5 name="check" size={16} color="#D4AF37" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity 
                                className="flex-row items-center" 
                                onPress={() => {
                                    setNewName(team.name);
                                    setIsEditingName(true);
                                }}
                            >
                                <Text className="text-white text-lg font-bold uppercase tracking-widest mr-2">{team.name}</Text>
                                {!team.status && <FontAwesome5 name="edit" size={12} color="#D4AF37" style={{ opacity: 0.5 }} />}
                            </TouchableOpacity>
                        )}
                        <View className="flex-row items-center mt-1">
                            <Text className={`text-xs font-bold uppercase ${isRosterEditable ? 'text-green-400' : team.status === 'approved' ? 'text-green-400' : 'text-yellow-500'}`}>
                                {teamStatusText}
                            </Text>
                            <Text className="text-gray-500 text-xs mx-2">•</Text>
                            <Text className="text-gray-400 text-xs font-mono">ID: {team.tid || '---'}</Text>
                        </View>
                     </View>
                     <View className="w-10" />
                 </View>

                 <FlatList
                     data={members}
                     keyExtractor={item => item.id}
                     contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                     ListHeaderComponent={
                         <>
                             {/* Add Player Section (Only for Captains) */}
                             {/* Available Players Section */}
                             {isCaptain && (
                                <View className="mb-6 bg-surface/50 border border-border rounded-xl p-4">
                                    <View className="flex-row items-center justify-between mb-3 border-b border-border/50 pb-2">
                                        <Text className="text-white font-bold uppercase tracking-wider text-xs">{team.status ? 'Current Roster' : 'Available Players'}</Text>
                                        <Text className="text-gray-400 text-[10px] uppercase">{members.length}/6 Members</Text>
                                    </View>
                                    
                                    {team.status ? (
                                        <View className="py-2 items-center flex-row justify-center">
                                            <Ionicons name="lock-closed" size={14} color="#D4AF37" style={{ marginRight: 6 }} />
                                            <Text className="text-gray-400 text-xs uppercase tracking-widest font-bold">Roster Locked</Text>
                                        </View>
                                    ) : members.length < 6 ? (
                                        availablePlayers.length > 0 ? (
                                            <FlatList
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                data={availablePlayers}
                                                keyExtractor={p => p.id}
                                                renderItem={({ item: player }) => {
                                                    const { firstLine, secondLine } = getPlayerNameLines(player.full_name);

                                                    return (
                                                    <TouchableOpacity 
                                                        onPress={() => handleAddPlayer(player)}
                                                        disabled={addLoading}
                                                        className="bg-black/30 p-3 rounded-xl border border-primary/20 items-center w-28 mr-3"
                                                    >
                                                        {player.avatar_url ? (
                                                            <Image source={{ uri: player.avatar_url }} className="w-10 h-10 rounded-full mb-2 border border-primary/30" />
                                                        ) : (
                                                            <View className="w-10 h-10 bg-surface rounded-full items-center justify-center mb-2 border border-border">
                                                                <FontAwesome5 name="user" size={14} color="#9CA3AF" />
                                                            </View>
                                                        )}
                                                        <View className="min-h-[30px] justify-center mb-1">
                                                            <Text className="text-white font-bold text-xs text-center leading-4" numberOfLines={1}>
                                                                {firstLine}
                                                            </Text>
                                                            {!!secondLine && (
                                                                <Text className="text-white font-bold text-[11px] text-center leading-4" numberOfLines={2}>
                                                                    {secondLine}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        <View className="bg-primary/20 px-2 py-0.5 rounded">
                                                            <Text className="text-primary font-bold text-[10px]">{getBreakpointLevel(player.breakpoint_rating)}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                    );
                                                }}
                                            />
                                        ) : (
                                            <View className="py-2 items-center">
                                                <Text className="text-gray-500 text-xs italic">No more available players in this session.</Text>
                                            </View>
                                        )
                                    ) : (
                                        <View className="py-2 items-center">
                                            <Text className="text-yellow-500 font-bold text-sm">Roster is full (6 max)</Text>
                                        </View>
                                    )}
                                </View>
                             )}

                             <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest pl-2 mb-3 mt-2">
                                 {`Team Roster${teamBreakpointRangeLabel ? ` • ${teamBreakpointRangeLabel}` : ''}`}
                             </Text>
                         </>
                     }
                     renderItem={({ item }) => (
                         <View className="bg-surface border border-border p-3 rounded-xl mb-3 flex-row items-center justify-between">
                             <View className="flex-row items-center flex-1">
                                 {item.profiles?.avatar_url ? (
                                     <Image source={{ uri: item.profiles.avatar_url }} className="w-12 h-12 rounded-full mr-3 border-2 border-primary/20" />
                                 ) : (
                                     <View className="w-12 h-12 bg-black/40 rounded-full items-center justify-center mr-3 border-2 border-primary/20">
                                         <FontAwesome5 name="user-ninja" size={20} color="#D4AF37" />
                                     </View>
                                 )}
                                 <View className="flex-1">
                                     <View className="flex-row items-center">
                                        <Text className="text-white text-base font-bold mb-0.5 mr-2">{item.profiles?.full_name || 'Player'}</Text>
                                        {item.player_id === team.captain_id && <FontAwesome5 name="crown" size={12} color="#D4AF37" />}
                                     </View>
                                     <Text className="text-gray-400 text-xs mb-0.5">Member ID: {item.profiles?.player_number || 'N/A'}</Text>
                                     <Text className="text-gray-500 text-xs font-mono">BP: <Text className="text-primary">{getBreakpointLevel(item.profiles?.breakpoint_rating)}</Text></Text>
                                 </View>
                             </View>

                             {isCaptain && item.player_id !== userId && !team.status && (
                                 <TouchableOpacity 
                                     onPress={() => handleRemovePlayer(item)}
                                     className="w-10 h-10 items-center justify-center bg-red-500/10 border border-red-500/20 rounded-full ml-2"
                                 >
                                     <FontAwesome5 name="user-minus" size={14} color="#EF4444" />
                                 </TouchableOpacity>
                             )}
                             </View>
                         )}
                         ListFooterComponent={
                             isCaptain && members.length === 6 && isRosterEditable ? (
                                 <View className="mt-4 mb-10 px-2">
                                     <TouchableOpacity 
                                         onPress={handleSubmitTeam}
                                         disabled={submitLoading}
                                         className="bg-primary py-4 rounded-xl items-center shadow-lg shadow-primary/30"
                                     >
                                         {submitLoading ? (
                                             <ActivityIndicator color="black" />
                                         ) : (
                                             <Text className="text-black font-black uppercase tracking-widest text-base">Submit Roster for Approval</Text>
                                         )}
                                     </TouchableOpacity>
                                     <Text className="text-gray-500 text-center text-[10px] uppercase mt-3 tracking-tighter">Required for league participation</Text>
                                 </View>
                             ) : isCaptain && (team.status === 'submitted' || team.status === 'approved' || team.status === 'edit_requested') ? (
                                 <View className="mt-4 mb-10 items-center">
                                     <View className={`px-4 py-2 rounded-full border mb-4 ${team.status === 'approved' ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                                         <Text className={`text-xs font-bold uppercase tracking-widest ${team.status === 'approved' ? 'text-green-400' : 'text-yellow-500'}`}>
                                             Team {team.status.replace('_', ' ')}
                                         </Text>
                                     </View>
                                     
                                     {team.status === 'approved' && (
                                         <TouchableOpacity 
                                             onPress={handleRequestEdit}
                                             disabled={submitLoading}
                                             className="bg-surface border border-border px-8 py-3 rounded-xl flex-row items-center"
                                         >
                                             <FontAwesome5 name="edit" size={12} color="#D4AF37" style={{ marginRight: 8 }} />
                                             <Text className="text-white font-bold uppercase tracking-wider text-xs">Request Roster Edit</Text>
                                         </TouchableOpacity>
                                     )}
                                     
                                     <Text className="text-gray-500 text-[8px] mt-2 uppercase tracking-tight">
                                         {team.status === 'edit_requested' ? 'Waiting for operator permission to edit' : 'Awaiting further instructions'}
                                     </Text>
                                 </View>
                             ) : <View className="h-20" />
                         }
                     />
             </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
