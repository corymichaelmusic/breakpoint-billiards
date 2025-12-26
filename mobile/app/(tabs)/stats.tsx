import { View, Text, SafeAreaView, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { getBreakpointLevel } from "../../utils/rating";

export default function StatsScreen() {
    const { userId, getToken } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any>(null);

    const fetchStats = async () => {
        try {
            if (!userId) return;

            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            // Fetch User Profile for current rating
            const { data: profile } = await supabase
                .from('profiles')
                .select('breakpoint_rating, full_name')
                .eq('id', userId)
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
                .eq('player_id', userId);

            if (leagueError) console.error("Error fetching league stats:", leagueError);

            // Set-based Stats for Breakdowns
            let stats8 = { played: 0, wins: 0, winRate: 0, br: 0, rr: 0, winZip: 0, racksWon: 0, racksLost: 0, rackWinRate: 0 };
            let stats9 = { played: 0, wins: 0, winRate: 0, br: 0, snap: 0, winZip: 0, rr: 0, racksWon: 0, racksLost: 0, rackWinRate: 0 };
            let lifetime = {
                played: 0,
                wins: 0,
                points: 0,
                winRate: 0,
                ppm: "0.00",
                bp: getBreakpointLevel(currentRating),
                rank: 0,
                racksPlayed: 0,
                shutouts: 0
            };

            let totalPlayed = 0;
            let totalWins = 0;
            let totalPoints = 0;
            lifetime.rank = rank;

            // Granular from DB
            let db_br8 = 0;
            let db_br9 = 0;
            let db_rr8 = 0;
            let db_rr9 = 0;
            let db_wz8 = 0;
            let db_wz9 = 0;
            let db_snap = 0;

            // Aggregation Vars for Lifetime
            let totalRacksPlayed = 0;
            let totalShutouts = 0;

            if (leagueStats) {
                leagueStats.forEach(ls => {
                    totalPlayed += ls.matches_played || 0;
                    totalWins += ls.matches_won || 0;
                    totalRacksPlayed += ls.breakpoint_racks_played || 0;
                    totalShutouts += ls.shutouts || 0;

                    // Sum Split Stats
                    db_br8 += ls.total_break_and_runs_8ball || 0;
                    db_br9 += ls.total_break_and_runs_9ball || 0;
                    db_rr8 += ls.total_rack_and_runs_8ball || 0;
                    db_rr9 += ls.total_rack_and_runs_9ball || 0;
                    db_wz8 += ls.total_win_zip_8ball || 0;
                    db_wz9 += ls.total_win_zip_9ball || 0;

                    db_snap += ls.total_nine_on_snap || 0;
                });
            }

            // Populate the UI objects with accurate split counts
            stats8.br = db_br8;
            stats8.rr = db_rr8;
            stats8.winZip = db_wz8;

            stats9.br = db_br9;
            stats9.rr = db_rr9;
            stats9.winZip = db_wz9;
            stats9.snap = db_snap;

            // Assign lifetime aggregated values
            lifetime.racksPlayed = totalRacksPlayed;
            lifetime.shutouts = totalShutouts;

            const matchQuery = await supabase
                .from("matches")
                .select("*")
                .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
                .or('status_8ball.eq.finalized,status_9ball.eq.finalized');

            if (matchQuery.data) {
                matchQuery.data.forEach(m => {
                    const isP1 = m.player1_id === userId;
                    const myPtsMatch = isP1 ? (m.points_8ball_p1 + m.points_9ball_p1) : (m.points_8ball_p2 + m.points_9ball_p2);
                    lifetime.points += myPtsMatch;

                    // 8-Ball Stats
                    const p1_8 = Number(m.points_8ball_p1) || 0;
                    const p2_8 = Number(m.points_8ball_p2) || 0;
                    const status8 = m.status_8ball;

                    if (status8 === 'finalized') {
                        stats8.played++;
                        // Determine winner based on points if status finalized, or reliable winner_id?
                        // Using points is consistent with previous logic
                        if ((isP1 ? p1_8 : p2_8) > (isP1 ? p2_8 : p1_8)) stats8.wins++;

                        stats8.racksWon += (isP1 ? p1_8 : p2_8);
                        stats8.racksLost += (isP1 ? p2_8 : p1_8);
                    }

                    // 9-Ball Stats
                    const p1_9 = Number(m.points_9ball_p1) || 0;
                    const p2_9 = Number(m.points_9ball_p2) || 0;
                    const status9 = m.status_9ball;

                    if (status9 === 'finalized') {
                        stats9.played++;
                        if ((isP1 ? p1_9 : p2_9) > (isP1 ? p2_9 : p1_9)) stats9.wins++;

                        stats9.racksWon += (isP1 ? p1_9 : p2_9);
                        stats9.racksLost += (isP1 ? p2_9 : p1_9);
                    }
                });
            }

            // Recalculate Aggregates
            lifetime.played = stats8.played + stats9.played;
            lifetime.wins = stats8.wins + stats9.wins;
            lifetime.winRate = lifetime.played > 0 ? Math.round((lifetime.wins / lifetime.played) * 100) : 0;
            lifetime.ppm = lifetime.played > 0 ? (lifetime.points / lifetime.played).toFixed(2) : "0.00";

            // If leagueStats RacksPlayed is 0 (missing data), fallback to crude calculation?
            // Crude: 1 point = 1 rack won approx? No.
            // Let's trust leagueStats.

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
    }, [userId]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchStats();
    }, []);

    if (loading) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color="#D4AF37" /></View>;

    return (
        <SafeAreaView className="flex-1 bg-background">

            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
            >
                <View className="p-6">

                    {/* Lifetime Stats (Matches) */}
                    <View className="bg-surface border border-border rounded-xl p-4 mb-6">
                        <View className="flex-row justify-between items-center mb-4 border-b border-border pb-2">
                            <Text className="text-foreground text-lg font-bold max-w-[70%]">
                                Lifetime Stats for {stats?.fullName || 'Player'}
                            </Text>
                            <TouchableOpacity onPress={() => router.push('/global-leaderboard')}>
                                <Text className="text-primary font-bold text-base">
                                    Rank: {stats?.lifetime?.rank || '-'}
                                </Text>
                            </TouchableOpacity>
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
                            onPress={() => router.push('/match-history')}
                            className="mt-4 bg-primary/10 border border-primary p-3 rounded-lg items-center"
                        >
                            <Text className="text-primary font-bold uppercase text-xs tracking-widest">View Match History</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 8-Ball Stats (Games) */}
                    <View className="bg-surface border border-border rounded-xl p-4 mb-6">
                        <View className="flex-row justify-between items-center border-b border-border pb-2 mb-4">
                            <Text className="text-foreground text-lg font-bold">8-Ball Sets</Text>
                            <View className="flex-row items-center gap-2">
                                <Text className="text-[#D4AF37] text-xs font-bold uppercase">
                                    {(stats?.stats8?.racksWon || 0) + (stats?.stats8?.racksLost || 0)} Racks: {stats?.stats8?.racksWon || 0}-{stats?.stats8?.racksLost || 0}
                                </Text>
                                <Text className="text-[#D4AF37] text-xs font-bold uppercase">({stats?.stats8?.rackWinRate || 0}%)</Text>
                            </View>
                        </View>
                        <StatRow label="Win %" value={`${stats?.stats8?.winRate || 0}%`} />
                        <StatRow label="W-L" value={`${stats?.stats8?.wins || 0}-${(stats?.stats8?.played || 0) - (stats?.stats8?.wins || 0)}`} />
                        <StatRow label="Break & Runs" value={stats?.stats8?.br || 0} />
                        <StatRow label="Rack & Runs" value={stats?.stats8?.rr || 0} />
                    </View>

                    {/* 9-Ball Stats (Games) */}
                    <View className="bg-surface border border-border rounded-xl p-4 mb-6">
                        <View className="flex-row justify-between items-center border-b border-border pb-2 mb-4">
                            <Text className="text-foreground text-lg font-bold">9-Ball Sets</Text>
                            <View className="flex-row items-center gap-2">
                                <Text className="text-[#D4AF37] text-xs font-bold uppercase">
                                    {(stats?.stats9?.racksWon || 0) + (stats?.stats9?.racksLost || 0)} Racks: {stats?.stats9?.racksWon || 0}-{stats?.stats9?.racksLost || 0}
                                </Text>
                                <Text className="text-[#D4AF37] text-xs font-bold uppercase">({stats?.stats9?.rackWinRate || 0}%)</Text>
                            </View>
                        </View>
                        <StatRow label="Win %" value={`${stats?.stats9?.winRate || 0}%`} />
                        <StatRow label="W-L" value={`${stats?.stats9?.wins || 0}-${(stats?.stats9?.played || 0) - (stats?.stats9?.wins || 0)}`} />
                        <StatRow label="Break & Run" value={stats?.stats9?.br || 0} />
                        <StatRow label="Win-Zip" value={stats?.stats9?.winZip || 0} />
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
            <Text className={`text-xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</Text>
            <Text className="text-gray-400 text-xs uppercase">{label}</Text>
        </View>
    )
}

function StatRow({ label, value }: { label: string, value: string | number }) {
    return (
        <View className="flex-row justify-between items-center py-3 border-b border-border last:border-0">
            <Text className="text-gray-300 font-medium">{label}</Text>
            <Text className="text-primary font-bold text-lg">{value}</Text>
        </View>
    )
}
