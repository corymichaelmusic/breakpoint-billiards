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
    const [memberIdInput, setMemberIdInput] = useState("");
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [addLoading, setAddLoading] = useState(false);

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
    }, [currentSession?.id, userId]); // Removed getToken as it can trigger infinite renders in Clerk

    useEffect(() => {
        fetchTeamData();
    }, [fetchTeamData]);

    const handleSearchPlayer = async () => {
        const queryText = memberIdInput.trim();
        if (queryText.length < 2) return;
        
        setSearchLoading(true);
        setSearchResults([]);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            if (!currentSession?.id) return;

            // 1. Get all players already on a team in this session
            const { data: takenMembers } = await supabase
                .from('team_members')
                .select('player_id, teams!inner(league_id)')
                .eq('teams.league_id', currentSession.id);
            
            const takenIds = takenMembers?.map(m => m.player_id) || [];

            // 2. Get players enrolled in this session who match the name AND are not in takenIds
            const { data: enrolledPlayers, error } = await supabase
                .from('league_players')
                .select('player_id, profiles!inner(id, full_name, nickname, breakpoint_rating, avatar_url, player_number)')
                .eq('league_id', currentSession.id)
                .not('player_id', 'in', `(${takenIds.join(',')})`)
                .or(`full_name.ilike.%${queryText}%,nickname.ilike.%${queryText}%`, { foreignTable: 'profiles' })
                .limit(10);

            if (error) throw error;

            const results = enrolledPlayers?.map(ep => ep.profiles) || [];
            setSearchResults(results as any[]);
            
            if (results.length === 0) {
                Alert.alert("No results", "No available players found in this session matching that name.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to search for player.");
        } finally {
            setSearchLoading(false);
        }
    };

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
            setMemberIdInput("");
            setSearchResults([]);
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
                                                        placeholder="Search player name..."
                                                        placeholderTextColor="#6B7280"
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

                                            {searchResults.length > 0 && (
                                                <View className="mt-4 gap-2">
                                                    {searchResults.map((player) => (
                                                        <View key={player.id} className="bg-black/30 p-3 rounded-lg border border-primary/30 flex-row items-center justify-between">
                                                            <View className="flex-row items-center flex-1">
                                                                {player.avatar_url ? (
                                                                    <Image source={{ uri: player.avatar_url }} className="w-10 h-10 rounded-full mr-3 border border-border" />
                                                                ) : (
                                                                    <View className="w-10 h-10 bg-surface rounded-full items-center justify-center mr-3 border border-border">
                                                                        <FontAwesome5 name="user" size={14} color="#9CA3AF" />
                                                                    </View>
                                                                )}
                                                                <View className="flex-1">
                                                                    <Text className="text-white font-bold" numberOfLines={1}>{player.full_name || 'Unknown'}</Text>
                                                                    <Text className="text-gray-400 text-xs">BP: {getBreakpointLevel(player.breakpoint_rating)}</Text>
                                                                </View>
                                                            </View>
                                                            
                                                            <TouchableOpacity 
                                                                onPress={() => handleAddPlayer(player)}
                                                                disabled={addLoading}
                                                                className="bg-primary px-4 py-2 rounded-lg flex-row items-center ml-2"
                                                            >
                                                                {addLoading ? <ActivityIndicator color="#000" size="small" /> : <Text className="text-black font-bold uppercase text-xs tracking-wider">Add</Text>}
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
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
