
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { FontAwesome5 } from '@expo/vector-icons';

import { getBreakpointLevel } from "../utils/rating";

export default function LeaderboardScreen() {
    const { getToken, userId } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [players, setPlayers] = useState<any[]>([]);

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            // Fetch Top 50 Players by Rating
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, breakpoint_rating')
                .order('breakpoint_rating', { ascending: false })
                .limit(50);

            if (data) {
                setPlayers(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="px-4 py-4 bg-background border-b border-white/5 flex-row justify-between items-center">
                <View className="flex-row items-center flex-1 mr-4">
                    <TouchableOpacity onPress={() => router.replace('/stats')} className="mr-4 p-2 -ml-2">
                        <FontAwesome5 name="arrow-left" size={20} color="#D4AF37" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-xl font-bold text-white uppercase tracking-wide shrink" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>
                            Global Leaderboard
                        </Text>
                        <Text className="text-gray-400 uppercase tracking-widest text-[10px]" style={{ includeFontPadding: false }}>
                            Breakpoint Rating
                        </Text>
                    </View>
                </View>
                <Image
                    source={require('../assets/branding-text-gold.png')}
                    style={{ width: 120, height: 26 }}
                    resizeMode="contain"
                />
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#D4AF37" />
                </View>
            ) : (
                <ScrollView className="flex-1 p-4">
                    <View className="bg-surface border border-border rounded-xl overflow-hidden mb-6">
                        {/* Header */}
                        <View className="flex-row bg-white/5 p-3 border-b border-white/10">
                            <Text className="text-gray-400 font-bold w-12 text-center">#</Text>
                            <Text className="text-gray-400 font-bold flex-1">Player</Text>
                            <Text className="text-gray-400 font-bold w-20 text-center">Level</Text>
                        </View>

                        {/* Rows */}
                        {players.map((player, index) => {
                            const isMe = player.id === userId;
                            return (
                                <TouchableOpacity
                                    key={player.id}
                                    onPress={() => router.push(`/player/${player.id}`)}
                                    disabled={isMe}
                                    className={`flex-row items-center p-3 border-b border-white/5 ${isMe ? 'bg-primary/10' : ''}`}
                                >
                                    <View className="w-12 items-center">
                                        {index < 3 ? (
                                            <FontAwesome5
                                                name="crown"
                                                size={14}
                                                color={index === 0 ? "#FFD700" : index === 1 ? "#C0C0C0" : "#CD7F32"}
                                            />
                                        ) : (
                                            <Text className="text-gray-400 font-bold">{index + 1}</Text>
                                        )}
                                    </View>
                                    <Text className={`flex-1 font-bold ${isMe ? 'text-primary' : 'text-white'}`}>
                                        {player.full_name || 'Unknown'}
                                    </Text>
                                    <View className="w-20 items-center">
                                        <View className="bg-primary/20 px-2 py-1 rounded">
                                            <Text className="text-primary font-bold" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                                                {getBreakpointLevel(player.breakpoint_rating || 500)}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
