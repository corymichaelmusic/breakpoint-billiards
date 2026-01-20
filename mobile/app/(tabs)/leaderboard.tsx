import { View, Text, ScrollView, ActivityIndicator, RefreshControl, FlatList, NativeSyntheticEvent, NativeScrollEvent, TouchableOpacity, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

import { getBreakpointLevel } from "../../utils/rating";

// Constants for Fixed Layout (Phone)
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 40;
const LEFT_COL_WIDTH = 184; // w-10 (40) + w-36 (144)
const RIGHT_COL_WIDTH_FIXED = 312;

export default function LeaderboardScreen() {
    const { userId, getToken } = useAuth();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 600; // Increased threshold slightly for tablet feel

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [sessionName, setSessionName] = useState("");
    const [leagueName, setLeagueName] = useState("");

    // Refs
    const headerScrollViewRef = useRef<ScrollView>(null);

    const fetchData = async () => {
        try {
            if (!userId) return;

            // 1. Authenticate Supabase
            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

            const supabaseAuthenticated = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    global: { headers: authHeader },
                }
            );


            // 1. Get Active Session First
            // PRIORITIZE ACTIVE status
            const { data: memberships } = await supabaseAuthenticated
                .from("league_players")
                .select("league_id, leagues!inner(name, type, status, parent_league:parent_league_id(name))")
                .eq("player_id", userId)
                .eq("leagues.type", "session")
                .in("leagues.status", ["active", "setup"])
                .order("leagues(status)", { ascending: true }) // active < setup? No, alphabetical. active(a) < setup(s). So Active first.
                // Wait, sorting by joined column on nested relation is tricky.
                // Best to fetch all and sort in JS if few.
                // Or just trust the status sort if we can.
                // Let's try to just fetch them and pick the text 'active' one.
                .limit(5); // Fetch top 5 recent to be safe

            if (!memberships || memberships.length === 0) {
                setLoading(false);
                return;
            }

            // Client-side Priority: Active > Setup > Completed
            const sorted = memberships.sort((a: any, b: any) => {
                const statusMap: Record<string, number> = { 'active': 1, 'setup': 2, 'completed': 3 };
                const sA = statusMap[a.leagues.status] || 99;
                const sB = statusMap[b.leagues.status] || 99;
                return sA - sB;
            });

            const activeSession = sorted[0];

            if (activeSession) {
                setSessionName(activeSession.leagues.name);
                setLeagueName(activeSession.leagues.parent_league?.name || '');
                const leagueId = activeSession.league_id;

                // 3. Fetch Pre-Calculated Stats from league_players
                // This replaces the expensive client-side aggregation
                const { data: players } = await supabaseAuthenticated
                    .from("league_players")
                    .select("player_id, matches_played, matches_won, shutouts, profiles:player_id(full_name, breakpoint_rating)")
                    .eq("league_id", leagueId);

                if (players && players.length > 0) {
                    const statsArray = players.map((p: any) => {
                        const name = p.profiles?.full_name || 'Unknown';
                        const rating = p.profiles?.breakpoint_rating ?? 500;
                        const played = p.matches_played || 0;
                        const wins = p.matches_won || 0;
                        const shutouts = p.shutouts || 0;

                        return {
                            id: p.player_id,
                            name,
                            wins,
                            played,
                            shutouts,
                            winRate: played > 0 ? Math.round((wins / played) * 100) : 0,
                            breakPoint: getBreakpointLevel(rating),
                            rating // raw for tiebreak
                        };
                    });

                    statsArray.sort((a, b) => {
                        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                        return b.played - a.played; // Secondary: More matches played
                    });

                    // Assign Rank
                    const ranked = statsArray.map((s, i) => ({ ...s, rank: i + 1 }));
                    setLeaderboard(ranked);
                } else {
                    setLeaderboard([]);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [userId]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, []);

    const handleHorizontalScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (isLargeScreen) return; // No sync needed if not scrolling
        const x = event.nativeEvent.contentOffset.x;
        headerScrollViewRef.current?.scrollTo({ x, animated: false });
    };

    if (loading) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color="#D4AF37" /></View>;

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom', 'left', 'right']}>
            <View className="p-4 bg-background border-b border-border items-center z-50">

                <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>Session Leaderboard  </Text>
                <Text className="text-foreground text-2xl font-bold tracking-wider uppercase text-center" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>{sessionName || 'Session'} </Text>
                <Text className="text-primary font-bold tracking-widest uppercase text-sm mt-1" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>{leagueName || 'Leaderboard'} </Text>
            </View>

            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
                stickyHeaderIndices={[0]}
            >
                {/* 0. Sticky Header Container */}
                <View style={{ height: HEADER_HEIGHT }} className="flex-row bg-[#D4AF37] border-b border-black z-20 shadow-lg">
                    {/* Left Header (Fixed) */}
                    <View style={{ width: LEFT_COL_WIDTH, height: HEADER_HEIGHT }} className="flex-row items-center border-r border-black/20 px-2">
                        <Text className="w-10 text-center text-black font-bold text-sm">RK</Text>
                        <Text className="w-36 ml-2 text-black font-bold text-sm">PLAYER</Text>
                    </View>

                    {/* Right Header (Adaptive) */}
                    {isLargeScreen ? (
                        <View style={{ flex: 1, height: HEADER_HEIGHT }} className="flex-row items-center px-4">
                            <Text className="flex-1 text-center text-black font-bold text-sm">SP</Text>
                            <Text className="flex-1 text-center text-black font-bold text-sm">W%</Text>
                            <Text className="flex-1 text-center text-black font-bold text-sm">W-L</Text>
                            <Text className="flex-1 text-center text-black font-bold text-sm">SO</Text>
                            <Text className="flex-1 text-center text-black font-bold text-sm" style={{ includeFontPadding: false }}>BP</Text>
                        </View>
                    ) : (
                        <ScrollView
                            horizontal
                            ref={headerScrollViewRef}
                            scrollEnabled={false}
                            showsHorizontalScrollIndicator={false}
                            style={{ flex: 1 }}
                        >
                            <View style={{ width: RIGHT_COL_WIDTH_FIXED, height: HEADER_HEIGHT }} className="flex-row items-center px-2">
                                <Text className="w-12 text-center text-black font-bold text-sm">SP</Text>
                                <Text className="w-14 text-center text-black font-bold text-sm">W%</Text>
                                <Text className="w-16 text-center text-black font-bold text-sm">W-L</Text>
                                <Text className="w-12 text-center text-black font-bold text-sm">SO</Text>
                                <Text className="w-10 text-center text-black font-bold text-sm" style={{ includeFontPadding: false }}>BP</Text>
                            </View>
                        </ScrollView>
                    )}
                </View>

                {/* 1. Body Container */}
                <View className="flex-row">
                    {/* Left Column Stack (Fixed) */}
                    <View style={{ width: LEFT_COL_WIDTH }} className="border-r border-border bg-background">
                        {leaderboard.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => router.push(`/player/${item.id}`)}
                                disabled={item.id === userId}
                                style={{ height: ROW_HEIGHT }}
                                className={`flex-row items-center px-2 border-b border-border ${item.id === userId ? 'bg-surface-hover' : ''}`}
                            >
                                <Text className={`w-10 text-center font-bold text-sm ${item.rank === 1 ? 'text-primary' : 'text-foreground'}`}>{item.rank}</Text>
                                <Text className="w-36 ml-2 text-foreground font-medium text-sm" numberOfLines={1}>{item.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Right Column Stack (Adaptive) */}
                    {isLargeScreen ? (
                        <View style={{ flex: 1 }}>
                            {leaderboard.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => router.push(`/player/${item.id}`)}
                                    disabled={item.id === userId}
                                    style={{ height: ROW_HEIGHT }}
                                    className={`flex-row items-center px-4 border-b border-border ${item.id === userId ? 'bg-surface-hover' : ''}`}
                                >
                                    <Text className="flex-1 text-center text-gray-400 font-bold text-sm">{item.played}</Text>
                                    <Text className="flex-1 text-center text-gray-300 font-bold text-sm">{item.winRate}%</Text>
                                    <Text className="flex-1 text-center text-foreground font-bold text-sm">{item.wins}-{item.played - item.wins}</Text>
                                    <Text className="flex-1 text-center text-primary font-bold text-sm">{item.shutouts}</Text>
                                    <Text className="flex-1 text-center text-primary font-bold text-sm" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>{item.breakPoint} </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={true}
                            scrollEventThrottle={16}
                            onScroll={handleHorizontalScroll}
                            style={{ flex: 1 }}
                        >
                            <View style={{ width: RIGHT_COL_WIDTH_FIXED }}>
                                {leaderboard.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => router.push(`/player/${item.id}`)}
                                        disabled={item.id === userId}
                                        style={{ height: ROW_HEIGHT }}
                                        className={`flex-row items-center px-2 border-b border-border ${item.id === userId ? 'bg-surface-hover' : ''}`}
                                    >
                                        <Text className="w-12 text-center text-gray-400 font-bold text-sm">{item.played}</Text>
                                        <Text className="w-14 text-center text-gray-300 font-bold text-sm">{item.winRate}%</Text>
                                        <Text className="w-16 text-center text-foreground font-bold text-sm">{item.wins}-{item.played - item.wins}</Text>
                                        <Text className="w-12 text-center text-primary font-bold text-sm">{item.shutouts}</Text>
                                        <Text className="w-10 text-center text-primary font-bold text-sm" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>{item.breakPoint} </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    )}
                </View>

                {leaderboard.length === 0 && (
                    <View className="p-8 items-center w-full">
                        <Text className="text-gray-500">No stats available yet.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
