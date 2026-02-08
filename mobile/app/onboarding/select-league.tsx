
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5 } from '@expo/vector-icons';

export default function SelectLeagueScreen() {
    const { getToken, userId } = useAuth();
    const { user } = useUser();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [leagues, setLeagues] = useState<any[]>([]);

    useEffect(() => {
        fetchLeagues();
    }, []);

    const fetchLeagues = async () => {
        try {
            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            // Fetch active SESSIONS
            // User requested to join a Session, not a League.
            const { data, error } = await supabase
                .from('leagues')
                .select(`
                    *,
                    parent_league:parent_league_id (
                        name,
                        location,
                        city
                    )
                `)
                .eq('type', 'session')
                .eq('status', 'setup')
                .order('name');

            if (error) throw error;
            setLeagues(data || []);
        } catch (e: any) {
            console.error(e);
            Alert.alert("Error", "Failed to load leagues.");
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (league: any) => {
        if (!userId) return;
        setJoining(true);
        try {
            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            // Check if user has any other sessions (active or setup)
            // If none, make this one Primary
            const { count } = await supabase
                .from('league_players')
                .select('league_id', { count: 'exact', head: true })
                .eq('player_id', userId);

            const isFirstSession = (count || 0) === 0;

            // Insert membership
            const { error } = await supabase
                .from('league_players')
                .insert({
                    league_id: league.id,
                    player_id: userId,
                    status: 'pending',
                    joined_at: new Date().toISOString(),
                    is_primary: isFirstSession
                });

            // If error is "duplicate key", it means already joined.
            if (error) {
                if (error.code === '23505') { // Unique violation
                    Alert.alert("Already Requested", "You have already sent a request or are a member.");
                    return;
                }
                throw error;
            }

            Alert.alert("Request Sent", `Your request to join ${league.name} has been sent to the operator.`, [
                { text: "OK", onPress: () => router.replace('/(tabs)') }
            ]);

        } catch (e: any) {
            console.error(e);

            // Self-Healing: If profile missing (FK violation), create it and retry
            if (e.code === '23503') { // Foreign Key Violation (player_id missing in profiles)
                try {
                    console.log("Profile missing (Self-Healing). Creating now...");
                    const token = await getToken({ template: 'supabase' });
                    const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;
                    const supabase = createClient(
                        process.env.EXPO_PUBLIC_SUPABASE_URL!,
                        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                        { global: { headers: authHeader } }
                    );

                    const email = user?.primaryEmailAddress?.emailAddress || "unknown@user.com";
                    const fullName = user?.fullName || email.split('@')[0];
                    const avatarUrl = user?.imageUrl;

                    const { error: profileError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: userId,
                            email: email,
                            full_name: fullName,
                            avatar_url: avatarUrl,
                            role: 'player' // Default role
                        });

                    if (profileError) throw profileError;

                    console.log("Profile created. Retrying join...");

                    // Retry Join
                    const { error: retryError } = await supabase
                        .from('league_players')
                        .insert({
                            league_id: league.id,
                            player_id: userId,
                            status: 'pending',
                            joined_at: new Date().toISOString()
                        });

                    if (retryError) throw retryError;

                    Alert.alert("Request Sent", `Your request to join ${league.name} has been sent to the operator.`, [
                        { text: "OK", onPress: () => router.replace('/(tabs)') }
                    ]);
                    return; // Success after retry

                } catch (retryE: any) {
                    console.error("Retry failed:", retryE);
                    Alert.alert("Error", "Failed to create profile. Please contact support.");
                    return;
                }
            }

            Alert.alert("Error", "Failed to join league.");
        } finally {
            setJoining(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="px-4 py-8 items-center bg-background border-b border-border/50 relative">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="absolute left-4 top-8 p-2 z-10"
                >
                    <FontAwesome5 name="chevron-left" size={20} color="#D4AF37" />
                </TouchableOpacity>

                <Image
                    source={require('../../assets/branding.png')}
                    style={{ width: 180, height: 40, marginBottom: 16 }}
                    resizeMode="contain"
                />
                <Text className="text-white text-2xl font-bold mb-2" numberOfLines={1} adjustsFontSizeToFit>Select a Session</Text>
                <Text className="text-gray-400 text-center">
                    Join an active session to start tracking your stats.
                </Text>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#D4AF37" size="large" />
                </View>
            ) : (
                <FlatList
                    data={leagues}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            disabled={joining}
                            onPress={() => handleJoin(item)}
                            className="bg-surface border border-border p-4 rounded-xl mb-4 flex-row justify-between items-center active:bg-primary/10"
                        >
                            <View className="flex-1 mr-4">
                                {/* Display Parent League Name as main title, Session Name as subtitle */}
                                <Text className="text-white text-lg font-bold mb-1">
                                    {item.parent_league?.name || item.name}
                                </Text>
                                <Text className="text-gray-400 text-sm mb-1">
                                    {item.name}
                                </Text>
                                {(item.parent_league?.location || item.location || item.parent_league?.city || item.city) && (
                                    <View className="flex-row items-center mb-1">
                                        <FontAwesome5 name="map-marker-alt" size={12} color="#9CA3AF" className="mr-2" />
                                        <Text className="text-gray-400 text-xs ml-1">
                                            {item.parent_league?.location || item.location ? `${item.parent_league?.location || item.location}` : ''}
                                            {(item.parent_league?.location || item.location) && (item.parent_league?.city || item.city) ? `, ${item.parent_league?.city || item.city}` : (item.parent_league?.city || item.city)}
                                        </Text>
                                    </View>
                                )}
                                {item.schedule_day && (
                                    <View className="flex-row items-center">
                                        <FontAwesome5 name="calendar-alt" size={12} color="#D4AF37" className="mr-2" />
                                        <Text className="text-primary text-xs ml-1 font-bold">
                                            {item.schedule_day}s
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <FontAwesome5 name="chevron-right" size={16} color="#D4AF37" />
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View className="items-center justify-center py-10">
                            <Text className="text-gray-400">No sessions available at this time</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
