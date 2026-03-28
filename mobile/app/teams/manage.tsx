import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { createClient } from "@supabase/supabase-js";
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSession } from "../../lib/SessionContext";
import { getBreakpointLevel } from "../../utils/rating";

export default function ManageTeamScreen() {
    const { getToken, userId } = useAuth();
    const router = useRouter();
    const { currentSession } = useSession();

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
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .select('*')
                .eq('league_id', currentSession.id)
                .or(`captain_id.eq.${userId}`) // Can expand if regular members can view this screen
                .single();

            if (teamError && teamError.code !== 'PGRST116') {
                console.error("Error fetching team:", teamError);
                return;
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
                    console.log("[DEBUG] Session ID:", currentSession.id);
                    console.log("[DEBUG] Taken IDs Count:", takenIds.length);
                    
                    const { data: available } = await supabase
                        .from('league_players')
                        .select('player_id, profiles!inner(id, full_name, nickname, breakpoint_rating, avatar_url, player_number)')
                        .eq('league_id', currentSession.id);

                    if (available) {
                        console.log("[DEBUG] Total Enrolled in Session:", available.length);
                        const filtered = available
                            .filter(ap => !takenIds.includes(ap.player_id))
                            .map(ap => ap.profiles);
                        console.log("[DEBUG] Filtered Available Count:", filtered.length);
                        setAvailablePlayers(filtered as any[]);
                    } else {
                        console.log("[DEBUG] No available players data returned from league_players");
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [currentSession?.id, userId]); // Removed getToken as it can trigger infinite renders in Clerk

    useEffect(() => {
        fetchTeamData();
    }, [fetchTeamData]);



    const handleAddPlayer = async (player: any) => {
        if (!player || !team) return;

        if (members.length >= 6) {
            Alert.alert("Roster Full", "Your team already has the maximum of 6 players.");
            return;
        }

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
            console.error(e);
            Alert.alert("Error", "Failed to add player to team.");
        } finally {
            setAddLoading(false);
        }
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

        console.log("[DEBUG] Renaming Team:", team.id, "to:", newName.trim());
        console.log("[DEBUG] Current User ID:", userId);

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
                console.error("[DEBUG] Rename error detail:", error);
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
                                <FontAwesome5 name="edit" size={12} color="#D4AF37" style={{ opacity: 0.5 }} />
                            </TouchableOpacity>
                        )}
                        <View className="flex-row items-center mt-1">
                            {team.status && (
                                <>
                                    <Text className={`text-xs font-bold uppercase ${team.status === 'approved' ? 'text-green-400' : 'text-yellow-500'}`}>
                                        {team.status}
                                    </Text>
                                    <Text className="text-gray-500 text-xs mx-2">•</Text>
                                </>
                            )}
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
                                        <Text className="text-white font-bold uppercase tracking-wider text-xs">Available Players</Text>
                                        <Text className="text-gray-400 text-[10px] uppercase">{members.length}/6 Members</Text>
                                    </View>
                                    
                                    {members.length < 6 ? (
                                        availablePlayers.length > 0 ? (
                                            <FlatList
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                data={availablePlayers}
                                                keyExtractor={p => p.id}
                                                renderItem={({ item: player }) => (
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
                                                        <Text className="text-white font-bold text-xs text-center mb-1" numberOfLines={1}>{player.full_name?.split(' ')[0] || 'Player'}</Text>
                                                        <View className="bg-primary/20 px-2 py-0.5 rounded">
                                                            <Text className="text-primary font-bold text-[10px]">{getBreakpointLevel(player.breakpoint_rating)}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                )}
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

                             <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest pl-2 mb-3 mt-2">Team Roster</Text>
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

                             {isCaptain && item.player_id !== userId && (
                                 <TouchableOpacity 
                                     onPress={() => handleRemovePlayer(item)}
                                     className="w-10 h-10 items-center justify-center bg-red-500/10 border border-red-500/20 rounded-full ml-2"
                                 >
                                     <FontAwesome5 name="user-minus" size={14} color="#EF4444" />
                                 </TouchableOpacity>
                             )}
                         </View>
                     )}
                 />
             </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
