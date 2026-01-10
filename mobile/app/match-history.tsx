import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5 } from "@expo/vector-icons";
import NextMatchCard from "../components/NextMatchCard";

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
                        leagues(name, parent_league:parent_league_id(name)),
                        games (winner_id, is_break_and_run, is_9_on_snap, game_type)
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
                        <Text className="text-xl font-bold text-white uppercase tracking-wide" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
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

                            const scores = {
                                p1_8: match.points_8ball_p1 || 0,
                                p2_8: match.points_8ball_p2 || 0,
                                p1_9: match.points_9ball_p1 || 0,
                                p2_9: match.points_9ball_p2 || 0,
                                isPlayer1: isP1
                            };

                            // Calculate Special Stats Dynamically
                            let p1_8br = 0, p2_8br = 0;
                            let p1_9br = 0, p2_9br = 0;
                            let p1_snap = 0, p2_snap = 0;

                            if (match.games) {
                                match.games.forEach((g: any) => {
                                    if (g.is_break_and_run) {
                                        if (g.game_type === '8ball') {
                                            if (g.winner_id === match.player1_id) p1_8br++;
                                            else if (g.winner_id === match.player2_id) p2_8br++;
                                        } else if (g.game_type === '9ball') {
                                            if (g.winner_id === match.player1_id) p1_9br++;
                                            else if (g.winner_id === match.player2_id) p2_9br++;
                                        }
                                    }
                                    if (g.is_9_on_snap) {
                                        if (g.winner_id === match.player1_id) p1_snap++;
                                        else if (g.winner_id === match.player2_id) p2_snap++;
                                    }
                                });
                            }

                            const specialStats = {
                                p1_8br, p2_8br,
                                p1_9br, p2_9br,
                                p1_snap, p2_snap
                            };

                            // Determine status strictly for display purposes
                            let effectiveStatus = match.status;

                            return (
                                <NextMatchCard
                                    key={match.id}
                                    matchId={match.id}
                                    opponentName={opponentName}
                                    date={match.scheduled_date ? new Date(match.scheduled_date).toLocaleDateString() : 'TBD'}
                                    weekNumber={match.week_number}
                                    status="finalized" // Force finalized to show stats
                                    player1Id={match.player1_id}
                                    player2Id={match.player2_id}
                                    paymentStatusP1={match.payment_status_p1}
                                    paymentStatusP2={match.payment_status_p2}
                                    label={`Week ${match.week_number}`}
                                    scores={scores}
                                    specialStats={specialStats}
                                    isLocked={true} // History items should be viewed as locked/completed
                                />
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
