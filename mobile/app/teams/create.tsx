import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5 } from '@expo/vector-icons';
import { useSession } from "../../lib/SessionContext";

export default function CreateTeamScreen() {
    const { getToken, userId } = useAuth();
    const { user } = useUser();
    const router = useRouter();
    const { currentSession } = useSession();

    const [teamName, setTeamName] = useState("");
    const [loading, setLoading] = useState(false);

    const handleCreateTeam = async () => {
        if (!teamName.trim()) {
            Alert.alert("Error", "Please enter a team name.");
            return;
        }

        if (!currentSession || !userId) {
            Alert.alert("Error", "No active session found. Please join a league session first.");
            return;
        }

        setLoading(true);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            // Generate a random 4-digit TID (e.g. T-1042)
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const tid = `T-${randomNum}`;

            // Insert Team
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .insert({
                    league_id: currentSession.id,
                    name: teamName.trim(),
                    captain_id: userId,
                    tid: tid,
                    status: 'pending' // Captain creates, Operator approves
                })
                .select()
                .single();

            if (teamError) {
                if (teamError.code === '23505') {
                    // Unique constraint (extremely unlikely on random 4 digit, but possible)
                    Alert.alert("Error", "Failed to generate a unique Team ID. Please try again.");
                } else {
                    throw teamError;
                }
                setLoading(false);
                return;
            }

            // Add Captain as first member
            const { error: memberError } = await supabase
                .from('team_members')
                .insert({
                    team_id: teamData.id,
                    player_id: userId
                });

            if (memberError) {
                console.error("Failed to add captain as member:", memberError);
                // We don't rollback team creation here for simplicity, but in a robust app we might.
            }

            Alert.alert("Team Created", `Your team '${teamName}' has been created and is pending approval. Team ID: ${tid}`, [
                { text: "OK", onPress: () => router.replace('/(tabs)') }
            ]);

        } catch (err: any) {
            console.error(err);
            Alert.alert("Error", "An error occurred while creating your team.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <View className="px-4 py-6 border-b border-border/50 relative flex-row items-center justify-center">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="absolute left-4 p-2 z-10"
                    >
                        <FontAwesome5 name="chevron-left" size={20} color="#D4AF37" />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold uppercase tracking-wider">Create Team</Text>
                </View>

                <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
                    <View className="items-center mb-8 mt-4">
                        <View className="bg-surface/50 w-24 h-24 rounded-full items-center justify-center mb-4 border border-primary/30">
                            <FontAwesome5 name="users" size={36} color="#D4AF37" />
                        </View>
                        <Text className="text-white text-xl font-bold mb-2 text-center">Form Your Squad</Text>
                        <Text className="text-gray-400 text-center px-4 leading-6">
                            Create a new team for the <Text className="text-primary font-bold">{currentSession?.name || 'current session'}</Text>. You will be the team captain.
                        </Text>
                    </View>

                    <View className="mb-6">
                        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Team Name</Text>
                        <View className="bg-surface border border-border rounded-xl flex-row items-center px-4 py-1 h-14">
                            <FontAwesome5 name="flag" size={16} color="#6B7280" className="mr-3" />
                            <TextInput
                                className="flex-1 text-white text-base"
                                placeholder="Enter team name"
                                placeholderTextColor="#6B7280"
                                value={teamName}
                                onChangeText={setTeamName}
                                autoCapitalize="words"
                                editable={!loading}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        className={`bg-primary rounded-full py-4 mt-4 shadow-lg flex-row justify-center items-center ${loading || !teamName.trim() ? 'opacity-50' : 'opacity-100'}`}
                        onPress={handleCreateTeam}
                        disabled={loading || !teamName.trim()}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <>
                                <Text className="text-black font-bold text-base uppercase tracking-wider mr-2">Create Team</Text>
                                <FontAwesome5 name="arrow-right" size={16} color="#000" />
                            </>
                        )}
                    </TouchableOpacity>

                    <Text className="text-gray-500 text-xs text-center mt-6">
                        By creating a team, you accept the responsibilities of Team Captain, including managing the roster and submitting match results.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
