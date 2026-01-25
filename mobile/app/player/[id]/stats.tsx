import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { getBreakpointLevel } from "../../../utils/rating";

export default function PlayerStatsScreen() {
    const { id: rawId } = useLocalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { getToken } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any>(null);

    const fetchStats = async () => {
        try {
            if (!id) return;

            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            // Fetch Profile for current rating and name
            const { data: profile } = await supabase
                .from('profiles')
                .select('breakpoint_rating, full_name')
                .eq('id', id)
                .single();
            const currentRating = profile?.breakpoint_rating || 500;

            // Calculate Global Rank
            const { count: higherRankedCount } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .gt('breakpoint_rating', currentRating);
            const rank = (higherRankedCount || 0) + 1;

            // 1. Fetch Aggregated Stats from league_players
            const { data: leagueStats, error: leagueError } = await supabase
                .from('league_players')
                .select('*')
                .eq('player_id', id);

            if (leagueError) console.error("Error fetching league stats:", leagueError);

            // Set-based Stats for Breakdowns
            let stats8 = { played: 0, wins: 0, winRate: 0, br: 0, rr: 0, racksWon: 0, racksLost: 0, rackWinRate: 0 };
            let stats9 = { played: 0, wins: 0, winRate: 0, br: 0, snap: 0, rr: 0, racksWon: 0, racksLost: 0, rackWinRate: 0 };
            let lifetime = {
                played: 0,
                wins: 0,
                points: 0,
                winRate: 0,
                ppm: "0.00",
                bp: getBreakpointLevel(currentRating),
                rank: rank,
                racksPlayed: 0,
                shutouts: 0
            };

            let totalPlayed = 0, totalWins = 0, totalRacksPlayed = 0, totalShutouts = 0;
            let db_br8 = 0, db_br9 = 0, db_rr8 = 0, db_rr9 = 0, db_snap = 0;

            if (leagueStats) {
                leagueStats.forEach(ls => {
                    totalPlayed += ls.matches_played || 0;
                    totalWins += ls.matches_won || 0;
                    totalRacksPlayed += ls.breakpoint_racks_played || 0;
                    totalShutouts += ls.shutouts || 0;

                    db_br8 += ls.total_break_and_runs_8ball || 0;
                    db_br9 += ls.total_break_and_runs_9ball || 0;
                    db_rr8 += ls.total_rack_and_runs_8ball || 0;
                    db_rr9 += ls.total_rack_and_runs_9ball || 0;
                    db_snap += ls.total_nine_on_snap || 0;
                });
            }

            stats8.br = db_br8;
            stats8.rr = db_rr8;
            stats9.br = db_br9;
            stats9.rr = db_rr9;
            stats9.snap = db_snap;
            lifetime.racksPlayed = totalRacksPlayed;
            lifetime.shutouts = totalShutouts;

            const matchQuery = await supabase
                .from("matches")
                .select("*")
                .or(`player1_id.eq.${id},player2_id.eq.${id}`)
                .or('status_8ball.eq.finalized,status_9ball.eq.finalized');

            if (matchQuery.data) {
                matchQuery.data.forEach(m => {
                    const isP1 = m.player1_id === id;
                    const myPtsMatch = isP1 ? (m.points_8ball_p1 + m.points_9ball_p1) : (m.points_8ball_p2 + m.points_9ball_p2);
                    lifetime.points += myPtsMatch;

                    const p1_8 = Number(m.points_8ball_p1) || 0;
                    const p2_8 = Number(m.points_8ball_p2) || 0;
                    if (m.status_8ball === 'finalized') {
                        stats8.played++;
                        if (m.winner_id_8ball === id) stats8.wins++;
                        stats8.racksWon += (isP1 ? p1_8 : p2_8);
                        stats8.racksLost += (isP1 ? p2_8 : p1_8);
                    }

                    const p1_9 = Number(m.points_9ball_p1) || 0;
                    const p2_9 = Number(m.points_9ball_p2) || 0;
                    if (m.status_9ball === 'finalized') {
                        stats9.played++;
                        if (m.winner_id_9ball === id) stats9.wins++;
                        stats9.racksWon += (isP1 ? p1_9 : p2_9);
                        stats9.racksLost += (isP1 ? p2_9 : p1_9);
                    }
                });
            }

            lifetime.played = stats8.played + stats9.played;
            lifetime.wins = stats8.wins + stats9.wins;
            lifetime.winRate = lifetime.played > 0 ? Math.round((lifetime.wins / lifetime.played) * 100) : 0;
            lifetime.ppm = lifetime.played > 0 ? (lifetime.points / lifetime.played).toFixed(2) : "0.00";

            stats8.winRate = stats8.played > 0 ? Math.round((stats8.wins / stats8.played) * 100) : 0;
            stats9.winRate = stats9.played > 0 ? Math.round((stats9.wins / stats9.played) * 100) : 0;

            const r8Total = stats8.racksWon + stats8.racksLost;
            stats8.rackWinRate = r8Total > 0 ? Math.round((stats8.racksWon / r8Total) * 100) : 0;

            const r9Total = stats9.racksWon + stats9.racksLost;
            stats9.rackWinRate = r9Total > 0 ? Math.round((stats9.racksWon / r9Total) * 100) : 0;

            setStats({ lifetime, stats8, stats9, fullName: profile?.full_name });

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [id]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchStats();
    }, []);

    if (loading) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color="#D4AF37" /></View>;

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* Header */}
            <View className="px-4 py-4 bg-background border-b border-white/5 flex-row justify-between items-center">
                <View className="flex-row items-center flex-1 mr-4">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2">
                        <FontAwesome5 name="arrow-left" size={20} color="#D4AF37" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-xl font-bold text-white uppercase tracking-wide" style={{ includeFontPadding: false }}>
                            Player Stats
                        </Text>
                        <Text className="text-gray-400 uppercase tracking-widest text-[10px]" style={{ includeFontPadding: false }}>
                            {stats?.fullName || 'Loading...'}
                        </Text>
                    </View>
                </View>
                <Image
                    source={require('../../../assets/branding-text-gold.png')}
                    style={{ width: 100, height: 22 }}
                    resizeMode="contain"
                />
            </View>

            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
            >
                <View className="p-6">
                    {/* Lifetime Stats */}
                    <View className="bg-surface border border-border rounded-xl p-4 mb-6">
                        <View className="flex-row justify-between items-center mb-4 border-b border-border pb-2">
                            <Text className="text-foreground text-lg font-bold max-w-[70%]">Lifetime Stats</Text>
                            <View>
                                <Text className="text-primary font-bold text-base" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                                    Rank: {stats?.lifetime?.rank || '-'}
                                </Text>
                            </View>
                        </View>
                        <View className="flex-row flex-wrap justify-between">
                            <StatBox label="Win %" value={`${stats?.lifetime?.winRate || 0}%`} />
                            <StatBox label="W-L" value={`${stats?.lifetime?.wins || 0}-${(stats?.lifetime?.played || 0) - (stats?.lifetime?.wins || 0)}`} />
                            <StatBox label="Sets Played" value={stats?.lifetime?.played || 0} />
                            <StatBox label="Confidence" value={stats?.lifetime?.racksPlayed || 0} />
                            <StatBox label="BP Level" value={stats?.lifetime?.bp || 1} highlight />
                            <StatBox label="Shutouts" value={stats?.lifetime?.shutouts || 0} />
                        </View>

                        <TouchableOpacity
                            onPress={() => router.push(`/match-history?playerId=${id}`)}
                            className="mt-4 bg-primary/10 border border-primary p-3 rounded-lg items-center"
                        >
                            <Text className="text-primary font-bold uppercase text-xs tracking-widest" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>View Match History  </Text>
                        </TouchableOpacity>
                    </View>

                    {/* 8-Ball Stats */}
                    <View className="bg-surface border border-border rounded-xl p-4 mb-6">
                        <View className="flex-row justify-between items-center border-b border-border pb-2 mb-4">
                            <Text className="text-foreground text-base font-bold shrink" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>8-Ball Sets</Text>
                            <View className="flex-row items-center gap-1 shrink">
                                <Text className="text-[#D4AF37] text-[10px] font-bold uppercase" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>
                                    {stats?.stats8?.racksWon + stats?.stats8?.racksLost} Racks: {stats?.stats8?.racksWon}-{stats?.stats8?.racksLost}
                                </Text>
                                <Text className="text-[#D4AF37] text-[10px] font-bold uppercase" style={{ includeFontPadding: false }}>({stats?.stats8?.rackWinRate}%)  </Text>
                            </View>
                        </View>
                        <StatRow label="Win %" value={`${stats?.stats8?.winRate || 0}%`} />
                        <StatRow label="W-L" value={`${stats?.stats8?.wins || 0}-${(stats?.stats8?.played || 0) - (stats?.stats8?.wins || 0)}`} />
                        <StatRow label="Break & Runs" value={stats?.stats8?.br || 0} />
                        <StatRow label="Rack & Runs" value={stats?.stats8?.rr || 0} />
                    </View>

                    {/* 9-Ball Stats */}
                    <View className="bg-surface border border-border rounded-xl p-4 mb-6">
                        <View className="flex-row justify-between items-center border-b border-border pb-2 mb-4">
                            <Text className="text-foreground text-base font-bold shrink" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>9-Ball Sets</Text>
                            <View className="flex-row items-center gap-1 shrink">
                                <Text className="text-[#D4AF37] text-[10px] font-bold uppercase" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>
                                    {stats?.stats9?.racksWon + stats?.stats9?.racksLost} Racks: {stats?.stats9?.racksWon}-{stats?.stats9?.racksLost}
                                </Text>
                                <Text className="text-[#D4AF37] text-[10px] font-bold uppercase" style={{ includeFontPadding: false }}>({stats?.stats9?.rackWinRate}%)  </Text>
                            </View>
                        </View>
                        <StatRow label="Win %" value={`${stats?.stats9?.winRate || 0}%`} />
                        <StatRow label="W-L" value={`${stats?.stats9?.wins || 0}-${(stats?.stats9?.played || 0) - (stats?.stats9?.wins || 0)}`} />
                        <StatRow label="Break & Run" value={stats?.stats9?.br || 0} />
                        <StatRow label="9 on the Snap" value={stats?.stats9?.snap || 0} />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function StatBox({ label, value, highlight }: { label: string, value: string | number, highlight?: boolean }) {
    return (
        <View className="w-[30%] items-center mb-4">
            <Text className={`text-xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`} numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>{value}   </Text>
            <Text className="text-gray-400 text-xs uppercase text-center" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>{label}  </Text>
        </View>
    )
}

function StatRow({ label, value }: { label: string, value: string | number }) {
    return (
        <View className="flex-row justify-between items-center py-3 border-b border-border last:border-0">
            <Text className="text-gray-300 font-medium flex-1 mr-2" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>{label}  </Text>
            <View className="min-w-[100px] shrink-0 items-end pr-1">
                <Text className="text-primary font-bold text-lg text-right" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit> {value}   </Text>
            </View>
        </View>
    )
}
