import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5 } from "@expo/vector-icons";
import { getBreakpointLevel } from "../../../utils/rating";
import NextMatchCard from "../../../components/NextMatchCard";
import { useSubscription } from "../../../lib/SubscriptionContext";
import UpgradeModal from "../../../components/UpgradeModal";

export default function PlayerDetailScreen() {
    const { id } = useLocalSearchParams();
    const { userId, getToken } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [matches, setMatches] = useState<any[]>([]);
    const [stats, setStats] = useState({ wins: 0, losses: 0, winRate: 0 });
    const { isPro } = useSubscription();
    const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);

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
                    leagues(name, parent_league:parent_league_id(name)),
                    player1:player1_id(full_name),
                    player2:player2_id(full_name),
                    games (winner_id, is_break_and_run, is_9_on_snap, game_type)
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
                    if (m.winner_id_8ball === userId) wins++;
                    else if (m.winner_id_8ball === id) losses++;
                }
                // 9-Ball
                if (m.status_9ball === 'finalized') {
                    if (m.winner_id_9ball === userId) wins++;
                    else if (m.winner_id_9ball === id) losses++;
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
                    source={require('../../../assets/branding-text-gold.png')}
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
                            <View className="bg-blue-500/20 px-3 py-1 rounded shrink-1">
                                <Text className="text-blue-500 font-bold" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>
                                    CONF: {profile?.confidence || 0}
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
                                <Text className="text-gray-400 text-xs uppercase tracking-widest" style={{ includeFontPadding: false }}>Win Rate vs.</Text>
                            </View>
                            <View className="w-[1px] bg-white/10" />
                            <View className="items-center flex-1 px-1">
                                <Text className="text-3xl font-bold text-white text-center" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>{stats.wins}-{stats.losses} </Text>
                                <Text className="text-gray-400 text-xs uppercase tracking-widest" style={{ includeFontPadding: false }}>Record vs.</Text>
                            </View>
                        </View>
                    </View>

                    {/* COMPLETE STATS BUTTON */}
                    <TouchableOpacity
                        onPress={() => {
                            if (isPro) {
                                router.push(`/player/${id}/stats`);
                            } else {
                                setUpgradeModalVisible(true);
                            }
                        }}
                        className="bg-primary/10 border border-primary/50 py-3 rounded-xl items-center mb-6 active:bg-primary/20"
                    >
                        <View className="flex-row items-center gap-2">
                            <FontAwesome5 name={isPro ? "chart-bar" : "lock"} size={16} color="#D4AF37" />
                            <Text className="text-primary font-bold uppercase tracking-widest text-sm" style={{ includeFontPadding: false }}>
                                See Complete Stats {!isPro && "(PRO)"}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <Text className="text-white font-bold text-lg mb-4">Match History</Text>

                    {matches.length > 0 ? (
                        matches.map((match) => {
                            const isP1 = match.player1_id === userId;

                            // Calculate Scores
                            const scores = {
                                p1_8: match.points_8ball_p1 || 0,
                                p2_8: match.points_8ball_p2 || 0,
                                p1_9: match.points_9ball_p1 || 0,
                                p2_9: match.points_9ball_p2 || 0,
                                winnerId8: match.winner_id_8ball,
                                winnerId9: match.winner_id_9ball,
                                isPlayer1: isP1
                            };

                            // Calculate Special Stats
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

                            return (
                                <NextMatchCard
                                    key={match.id}
                                    matchId={match.id}
                                    opponentName={isP1 ? (match.player2?.full_name || profile?.full_name) : (match.player1?.full_name || profile?.full_name)}
                                    date={new Date(match.scheduled_date).toLocaleDateString()}
                                    leagueName={match.leagues?.parent_league?.name}
                                    sessionName={match.leagues?.name}
                                    status="finalized" // History is always finalized or past
                                    player1Id={match.player1_id}
                                    player2Id={match.player2_id}
                                    scores={scores}
                                    specialStats={specialStats}
                                    label={`Week ${match.week_number}`}
                                />
                            );
                        })
                    ) : (
                        <Text className="text-gray-500 text-center mt-10">No matches found against this player.</Text>
                    )}
                </ScrollView>
            )
            }
            <UpgradeModal visible={upgradeModalVisible} onClose={() => setUpgradeModalVisible(false)} />
        </SafeAreaView >
    );
}
