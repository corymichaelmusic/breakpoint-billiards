import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5 } from "@expo/vector-icons";
import { getBreakpointLevel } from "../../utils/rating";

export default function PlayerDetailScreen() {
    const { id } = useLocalSearchParams();
    const { userId, getToken } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [matches, setMatches] = useState<any[]>([]);
    const [stats, setStats] = useState({ wins: 0, losses: 0, winRate: 0 });

    useEffect(() => {
        fetchData();
    }, [id, userId]);

    const fetchData = async () => {
        try {
            if (!userId || !id) return;
            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            // 1. Fetch Opponent Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();

            setProfile(profileData);

            // 2. Calculate Global Rank (Count players with higher rating)
            let rank = 1;
            let confidence = 0;
            if (profileData) {
                const { count, error } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .gt('breakpoint_rating', profileData.breakpoint_rating);

                if (!error) {
                    rank = (count || 0) + 1;
                }

                // Fetch Confidence (Total Racks Played from All Sessions)
                const { data: leagueStats } = await supabase
                    .from('league_players')
                    .select('breakpoint_racks_played')
                    .eq('player_id', id);

                if (leagueStats) {
                    confidence = leagueStats.reduce((sum, item) => sum + (item.breakpoint_racks_played || 0), 0);
                }
            }
            setProfile({ ...profileData, rank, confidence });

            // 3. Fetch H2H Matches
            const { data: matchData } = await supabase
                .from("matches")
                .select(`
                    *,
                    leagues(name, parent_league:parent_league_id(name))
                `)
                .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
                .or(`player1_id.eq.${id},player2_id.eq.${id}`)
                .or('status_8ball.eq.finalized,status_9ball.eq.finalized')
                .order("scheduled_date", { ascending: false });

            // Filter for exact H2H in memory to be safe with the OR logic
            const h2hMatches = (matchData || []).filter(m =>
                (m.player1_id === userId && m.player2_id === id) ||
                (m.player2_id === userId && m.player1_id === id)
            );

            setMatches(h2hMatches);

            // 3. Calculate Stats
            let wins = 0;
            let losses = 0;

            h2hMatches.forEach(m => {
                const isP1 = m.player1_id === userId;

                // 8-Ball
                if (m.status_8ball === 'finalized') {
                    const myPts = isP1 ? m.points_8ball_p1 : m.points_8ball_p2;
                    const oppPts = isP1 ? m.points_8ball_p2 : m.points_8ball_p1;
                    if (myPts > oppPts) wins++;
                    else if (oppPts > myPts) losses++;
                }
                // 9-Ball
                if (m.status_9ball === 'finalized') {
                    const myPts = isP1 ? m.points_9ball_p1 : m.points_9ball_p2;
                    const oppPts = isP1 ? m.points_9ball_p2 : m.points_9ball_p1;
                    if (myPts > oppPts) wins++;
                    else if (oppPts > myPts) losses++;
                }
            });

            const total = wins + losses;
            const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
            setStats({ wins, losses, winRate });

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="px-4 py-4 bg-background border-b border-white/5 flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2">
                        <FontAwesome5 name="arrow-left" size={20} color="#D4AF37" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-xl font-bold text-white uppercase tracking-wide" style={{ includeFontPadding: false }}>
                            Head to Head
                        </Text>
                        <Text className="text-gray-400 uppercase tracking-widest text-[10px]" style={{ includeFontPadding: false }}>
                            {profile?.full_name || 'Loading...'}
                        </Text>
                    </View>
                </View>
                <Image
                    source={require('../../assets/branding-text-gold.png')}
                    style={{ width: 100, height: 22 }}
                    resizeMode="contain"
                />
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#D4AF37" size="large" />
                </View>
            ) : (
                <ScrollView className="flex-1 p-4">
                    {/* Opponent Card */}
                    <View className="bg-surface border border-border rounded-xl p-6 mb-6 items-center">
                        <View className="w-20 h-20 bg-primary/20 rounded-full items-center justify-center mb-3 border-2 border-primary">
                            <FontAwesome5 name="user" size={30} color="#D4AF37" />
                        </View>
                        <Text className="text-white text-2xl font-bold mb-1 w-full text-center" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>{profile?.full_name} </Text>
                        <View className="flex-row gap-2 mb-4 justify-center w-full">
                            <View className="bg-primary/20 px-3 py-1 rounded shrink-1">
                                <Text className="text-primary font-bold" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>
                                    BP: {getBreakpointLevel(profile?.breakpoint_rating || 500)}
                                </Text>
                            </View>
                            <View className="bg-white/10 px-3 py-1 rounded border border-white/20 shrink-1">
                                <Text className="text-white font-bold" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>
                                    RANK: {profile?.rank || '-'}
                                </Text>
                            </View>
                        </View>

                        <View className="flex-row justify-around w-full px-2">
                            <View className="items-center flex-1">
                                <Text className="text-3xl font-bold text-white" style={{ includeFontPadding: false }}>{stats.winRate}%  </Text>
                                <Text className="text-gray-400 text-xs uppercase tracking-widest" style={{ includeFontPadding: false }}>Win Rate</Text>
                            </View>
                            <View className="w-[1px] bg-white/10" />
                            <View className="items-center flex-1 px-1">
                                <Text className="text-3xl font-bold text-white text-center" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>{stats.wins}-{stats.losses} </Text>
                                <Text className="text-gray-400 text-xs uppercase tracking-widest" style={{ includeFontPadding: false }}>Record</Text>
                            </View>
                            <View className="w-[1px] bg-white/10" />
                            <View className="items-center flex-1">
                                <Text className="text-3xl font-bold text-white" style={{ includeFontPadding: false }}>{profile?.confidence || 0} </Text>
                                <Text className="text-gray-400 text-xs uppercase tracking-widest" style={{ includeFontPadding: false }}>Confidence</Text>
                            </View>
                        </View>
                    </View>

                    <Text className="text-white font-bold text-lg mb-4">Match History</Text>

                    {matches.length > 0 ? (
                        matches.map((match) => {
                            const isP1 = match.player1_id === userId;
                            const played8 = (match.points_8ball_p1 || 0) > 0 || (match.points_8ball_p2 || 0) > 0;
                            const played9 = (match.points_9ball_p1 || 0) > 0 || (match.points_9ball_p2 || 0) > 0;

                            const my8 = isP1 ? match.points_8ball_p1 : match.points_8ball_p2;
                            const opp8 = isP1 ? match.points_8ball_p2 : match.points_8ball_p1;
                            const win8 = my8 > opp8;

                            const my9 = isP1 ? match.points_9ball_p1 : match.points_9ball_p2;
                            const opp9 = isP1 ? match.points_9ball_p2 : match.points_9ball_p1;
                            const win9 = my9 > opp9;

                            return (
                                <View
                                    key={match.id}
                                    className="bg-surface p-4 rounded-lg border border-border mb-4"
                                >
                                    <View className="flex-row justify-between items-start mb-4">
                                        <View>
                                            <Text className="text-gray-400 text-xs uppercase mb-1">{match.leagues?.parent_league?.name || 'League'}</Text>
                                            <Text className="text-white font-bold text-lg">
                                                {new Date(match.scheduled_date).toLocaleDateString()}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* 8-Ball Result */}
                                    {played8 && (
                                        <View className="flex-row items-center justify-between mb-2">
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-gray-300 font-bold text-sm w-12">8-Ball</Text>
                                                <View className={`px-2 py-0.5 rounded min-w-[50px] items-center ${win8 ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                                                    <Text className={`font-bold text-[10px] uppercase ${win8 ? 'text-green-500' : 'text-red-500'}`} style={{ includeFontPadding: false }} numberOfLines={1}>
                                                        {win8 ? 'Won  ' : 'Lost  '}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text className="text-white font-bold text-base min-w-[30px] text-right" style={{ includeFontPadding: false }}>
                                                {my8} - {opp8}
                                            </Text>
                                        </View>
                                    )}

                                    {/* 9-Ball Result */}
                                    {played9 && (
                                        <View className="flex-row items-center justify-between">
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-gray-300 font-bold text-sm w-12">9-Ball</Text>
                                                <View className={`px-2 py-0.5 rounded min-w-[50px] items-center ${win9 ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                                                    <Text className={`font-bold text-[10px] uppercase ${win9 ? 'text-green-500' : 'text-red-500'}`} style={{ includeFontPadding: false }} numberOfLines={1}>
                                                        {win9 ? 'Won  ' : 'Lost  '}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text className="text-white font-bold text-base min-w-[30px] text-right" style={{ includeFontPadding: false }}>
                                                {my9} - {opp9}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    ) : (
                        <Text className="text-gray-500 text-center mt-10">No matches found against this player.</Text>
                    )}
                </ScrollView>
            )
            }
        </SafeAreaView >
    );
}
