import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useSession } from "../../lib/SessionContext";

export default function ManageTeamScreen() {
    const { getToken, userId } = useAuth();
    const router = useRouter();
    const { currentSession } = useSession();

    const [loading, setLoading] = useState(true);
    const [team, setTeam] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    
    // Add Player State
    const [memberIdInput, setMemberIdInput] = useState("");
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<any | null>(null);
    const [addLoading, setAddLoading] = useState(false);

    const fetchTeamData = useCallback(async () => {
        if (!currentSession || !userId) return;
        setLoading(true);
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
                    .select('*, profiles(full_name, nickname, breakpoint_rating, avatar_url, player_number)')
                    .eq('team_id', teamData.id)
                    .order('joined_at', { ascending: true });

                if (!memError && membersData) {
                    setMembers(membersData);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [currentSession?.id, userId, getToken]);

    useEffect(() => {
        fetchTeamData();
    }, [fetchTeamData]);

    const handleSearchPlayer = async () => {
        if (!memberIdInput.trim()) return;
        
        setSearchLoading(true);
        setSearchResults(null);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            // Important: player_number is an integer in profiles table, so we need to cast input if necessary
            // or perform a text search depending on column type. Assuming integer/numeric.
            const searchNum = parseInt(memberIdInput.trim(), 10);
            if (isNaN(searchNum)) {
                Alert.alert("Error", "Member ID must be a number.");
                setSearchLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, nickname, breakpoint_rating, avatar_url, player_number')
                .eq('player_number', searchNum)
                .single();

            if (error || !data) {
                Alert.alert("Not Found", "No player found with this Member ID.");
            } else {
                // Check if already on team
                if (members.some(m => m.player_id === data.id)) {
                    Alert.alert("Error", "Player is already on your team.");
                } else {
                    setSearchResults(data);
                }
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to search for player.");
        } finally {
            setSearchLoading(false);
        }
    };

    const handleAddPlayer = async () => {
        if (!searchResults || !team) return;

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
                    player_id: searchResults.id
                });

            if (error) throw error;

            Alert.alert("Success", `${searchResults.full_name || 'Player'} added to team!`);
            setMemberIdInput("");
            setSearchResults(null);
            fetchTeamData(); // Refresh Roster

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
                        <Text className="text-white text-lg font-bold uppercase tracking-widest">{team.name}</Text>
                        <View className="flex-row items-center mt-1">
                            <Text className={`text-xs font-bold uppercase ${team.status === 'approved' ? 'text-green-400' : 'text-yellow-500'}`}>
                                {team.status}
                            </Text>
                            <Text className="text-gray-500 text-xs mx-2">•</Text>
                            <Text className="text-gray-400 text-xs font-mono">ID: {team.tid}</Text>
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
                             {isCaptain && (
                                <View className="mb-6 bg-surface/50 border border-border rounded-xl p-4">
                                    <View className="flex-row items-center justify-between mb-3 border-b border-border/50 pb-2">
                                        <Text className="text-white font-bold uppercase tracking-wider">Add Player</Text>
                                        <Text className="text-gray-400 text-xs">{members.length}/6 Members</Text>
                                    </View>
                                    
                                    {members.length < 6 ? (
                                        <>
                                            <View className="flex-row items-center gap-2">
                                                <View className="flex-1 bg-black/40 border border-border rounded-lg px-3 py-2 flex-row items-center">
                                                    <FontAwesome5 name="hashtag" size={14} color="#6B7280" className="mr-2" />
                                                    <TextInput 
                                                        className="flex-1 text-white"
                                                        placeholder="Enter Member ID"
                                                        placeholderTextColor="#6B7280"
                                                        keyboardType="numeric"
                                                        value={memberIdInput}
                                                        onChangeText={setMemberIdInput}
                                                        onSubmitEditing={handleSearchPlayer}
                                                    />
                                                </View>
                                                <TouchableOpacity 
                                                    onPress={handleSearchPlayer}
                                                    disabled={searchLoading}
                                                    className="bg-primary/20 border border-primary/50 w-12 h-12 rounded-lg items-center justify-center"
                                                >
                                                    {searchLoading ? <ActivityIndicator color="#D4AF37" size="small" /> : <FontAwesome5 name="search" size={16} color="#D4AF37" />}
                                                </TouchableOpacity>
                                            </View>

                                            {searchResults && (
                                                <View className="mt-4 bg-black/30 p-3 rounded-lg border border-primary/30 flex-row items-center justify-between">
                                                    <View className="flex-row items-center flex-1">
                                                        {searchResults.avatar_url ? (
                                                            <Image source={{ uri: searchResults.avatar_url }} className="w-10 h-10 rounded-full mr-3 border border-border" />
                                                        ) : (
                                                            <View className="w-10 h-10 bg-surface rounded-full items-center justify-center mr-3 border border-border">
                                                                <FontAwesome5 name="user" size={14} color="#9CA3AF" />
                                                            </View>
                                                        )}
                                                        <View className="flex-1">
                                                            <Text className="text-white font-bold" numberOfLines={1}>{searchResults.full_name || 'Unknown'}</Text>
                                                            <Text className="text-gray-400 text-xs">Rating: {searchResults.breakpoint_rating}</Text>
                                                        </View>
                                                    </View>
                                                    
                                                    <TouchableOpacity 
                                                        onPress={handleAddPlayer}
                                                        disabled={addLoading}
                                                        className="bg-primary px-4 py-2 rounded-lg flex-row items-center ml-2"
                                                    >
                                                        {addLoading ? <ActivityIndicator color="#000" size="small" /> : <Text className="text-black font-bold uppercase text-xs tracking-wider">Add</Text>}
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </>
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
                                     <Text className="text-gray-500 text-xs font-mono">BBR: <Text className="text-primary">{item.profiles?.breakpoint_rating || 500}</Text></Text>
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
