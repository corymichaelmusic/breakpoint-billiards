import { View, Text, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5 } from "@expo/vector-icons";

export default function MatchHistoryScreen() {
    const { userId, getToken } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [matches, setMatches] = useState<any[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                if (!userId) return;
                const token = await getToken({ template: 'supabase' });
                const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

                const supabase = createClient(
                    process.env.EXPO_PUBLIC_SUPABASE_URL!,
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    { global: { headers: authHeader } }
                );

                // Fetch ONLY FINISHED matches involving user
                const { data: fetchedMatches } = await supabase
                    .from("matches")
                    .select(`
                        *,
                        player1:player1_id(full_name),
                        player2:player2_id(full_name),
                        leagues(name, parent_league:parent_league_id(name))
                    `)
                    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
                    .or('status_8ball.eq.finalized,status_9ball.eq.finalized')
                    .order("scheduled_date", { ascending: false });

                if (fetchedMatches) setMatches(fetchedMatches);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [userId]);

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* Header */}
            {/* Header */}
            <View className="px-4 py-4 bg-background border-b border-white/5 flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2">
                        <FontAwesome5 name="arrow-left" size={20} color="#D4AF37" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-xl font-bold text-white uppercase tracking-wide">
                            Match History
                        </Text>
                        <Text className="text-gray-400 uppercase tracking-widest text-[10px]">
                            All Sessions
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
                    <ActivityIndicator color="#D4AF37" size="large" />
                </View>
            ) : (
                <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }}>
                    {matches.length > 0 ? (
                        matches.map((match) => {
                            const isP1 = match.player1_id === userId;
                            const opponentName = isP1 ? match.player2?.full_name : match.player1?.full_name || 'Unknown';

                            // 8-Ball Stats
                            const my8 = isP1 ? match.points_8ball_p1 : match.points_8ball_p2;
                            const opp8 = isP1 ? match.points_8ball_p2 : match.points_8ball_p1;
                            const played8 = (match.points_8ball_p1 || 0) > 0 || (match.points_8ball_p2 || 0) > 0;
                            const win8 = my8 > opp8;

                            // 9-Ball Stats
                            const my9 = isP1 ? match.points_9ball_p1 : match.points_9ball_p2;
                            const opp9 = isP1 ? match.points_9ball_p2 : match.points_9ball_p1;
                            const played9 = (match.points_9ball_p1 || 0) > 0 || (match.points_9ball_p2 || 0) > 0;
                            const win9 = my9 > opp9;

                            return (
                                <View
                                    key={match.id}
                                    className="bg-surface p-4 rounded-lg border border-border mb-4"
                                >
                                    <View className="flex-row justify-between items-start mb-4">
                                        <View>
                                            <Text className="text-gray-400 text-xs uppercase mb-1">{match.leagues?.parent_league?.name || 'League'}</Text>
                                            <Text className="text-white font-bold text-lg">vs {opponentName}</Text>
                                        </View>
                                        <Text className="text-gray-500 text-xs">
                                            {match.scheduled_date ? new Date(match.scheduled_date).toLocaleDateString() : 'TBD'}
                                        </Text>
                                    </View>

                                    {/* 8-Ball Result */}
                                    {played8 && (
                                        <View className="flex-row items-center justify-between mb-2">
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-gray-300 font-bold text-sm w-12">8-Ball</Text>
                                                <View className={`px-2 py-0.5 rounded ${win8 ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                                                    <Text className={`font-bold text-[10px] uppercase ${win8 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {win8 ? 'Won' : 'Lost'}
                                                    </Text>
                                                </View>

                                                {/* Special Badges 8-Ball */}
                                                {(isP1 ? match.p1_break_run_8ball : match.p2_break_run_8ball) > 0 && (
                                                    <View className="bg-primary/20 px-1.5 py-0.5 rounded border border-primary/50">
                                                        <Text className="text-primary text-[8px] font-bold uppercase">B&R</Text>
                                                    </View>
                                                )}
                                                {(isP1 ? match.p1_rack_run_8ball : match.p2_rack_run_8ball) > 0 && (
                                                    <View className="bg-primary/20 px-1.5 py-0.5 rounded border border-primary/50">
                                                        <Text className="text-primary text-[8px] font-bold uppercase">R&R</Text>
                                                    </View>
                                                )}
                                                {win8 && opp8 === 0 && (
                                                    <View className="bg-primary/20 px-1.5 py-0.5 rounded border border-primary/50">
                                                        <Text className="text-primary text-[8px] font-bold uppercase">Zip</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text className="text-white font-bold text-base">
                                                {my8} - {opp8}
                                            </Text>
                                        </View>
                                    )}

                                    {/* 9-Ball Result */}
                                    {played9 && (
                                        <View className="flex-row items-center justify-between">
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-gray-300 font-bold text-sm w-12">9-Ball</Text>
                                                <View className={`px-2 py-0.5 rounded ${win9 ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                                                    <Text className={`font-bold text-[10px] uppercase ${win9 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {win9 ? 'Won' : 'Lost'}
                                                    </Text>
                                                </View>

                                                {/* Special Badges 9-Ball */}
                                                {(isP1 ? match.p1_break_run_9ball : match.p2_break_run_9ball) > 0 && (
                                                    <View className="bg-primary/20 px-1.5 py-0.5 rounded border border-primary/50">
                                                        <Text className="text-primary text-[8px] font-bold uppercase">B&R</Text>
                                                    </View>
                                                )}
                                                {(isP1 ? match.p1_nine_on_snap : match.p2_nine_on_snap) > 0 && (
                                                    <View className="bg-primary/20 px-1.5 py-0.5 rounded border border-primary/50">
                                                        <Text className="text-primary text-[8px] font-bold uppercase">Snap</Text>
                                                    </View>
                                                )}
                                                {win9 && opp9 === 0 && (
                                                    <View className="bg-primary/20 px-1.5 py-0.5 rounded border border-primary/50">
                                                        <Text className="text-primary text-[8px] font-bold uppercase">Zip</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text className="text-white font-bold text-base">
                                                {my9} - {opp9}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    ) : (
                        <View className="items-center justify-center mt-20">
                            <Text className="text-gray-500 text-lg mb-2">No completed matches.</Text>
                            <Text className="text-gray-600 text-xs text-center w-64">
                                Matches will appear here once they are finalized.
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
