import { View, Text, ScrollView, ActivityIndicator, RefreshControl, FlatList, NativeSyntheticEvent, NativeScrollEvent, TouchableOpacity, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useSession } from "../../lib/SessionContext";

import { getBreakpointLevel } from "../../utils/rating";

// Constants for Fixed Layout (Phone)
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 40;
const LEFT_COL_WIDTH = 184; // w-10 (40) + w-36 (144)
const PLAYER_COL_WIDTH_FIXED = 440;
const TEAM_COL_WIDTH_FIXED = 440;

const formatRecord = (wins: number, losses: number) => `${wins}-${losses}`;
const formatPercent = (wins: number, total: number) => `${total > 0 ? Math.round((wins / total) * 100) : 0}%`;

export default function LeaderboardScreen() {
    const { userId, getToken } = useAuth();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 600; // Increased threshold slightly for tablet feel

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [teamLeaderboard, setTeamLeaderboard] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'players' | 'teams'>('players');
    const [sessionName, setSessionName] = useState("");
    const [leagueName, setLeagueName] = useState("");
    const { currentSession } = useSession();

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

            if (!currentSession) {
                setLoading(false);
                return;
            }

            setSessionName(currentSession.name);
            setLeagueName(currentSession.parentLeagueName || '');
            const leagueId = currentSession.id;

            const { data: sessionMatches } = await supabaseAuthenticated
                .from("matches")
                .select(`
                    player1_id,
                    player2_id,
                    status_8ball,
                    status_9ball,
                    winner_id_8ball,
                    winner_id_9ball
                `)
                .eq("league_id", leagueId);

            const playerStatsMap = new Map<string, { wins8: number; played8: number; wins9: number; played9: number }>();

            (sessionMatches || []).forEach((match: any) => {
                const ids = [match.player1_id, match.player2_id].filter(Boolean);

                ids.forEach((playerId: string) => {
                    if (!playerStatsMap.has(playerId)) {
                        playerStatsMap.set(playerId, { wins8: 0, played8: 0, wins9: 0, played9: 0 });
                    }
                });

                if (match.status_8ball === 'finalized') {
                    ids.forEach((playerId: string) => {
                        const stats = playerStatsMap.get(playerId)!;
                        stats.played8 += 1;
                        if (match.winner_id_8ball === playerId) stats.wins8 += 1;
                    });
                }

                if (match.status_9ball === 'finalized') {
                    ids.forEach((playerId: string) => {
                        const stats = playerStatsMap.get(playerId)!;
                        stats.played9 += 1;
                        if (match.winner_id_9ball === playerId) stats.wins9 += 1;
                    });
                }
            });

            // Fetch Teams Data
            const { data: teamsData } = await supabaseAuthenticated
                .from("teams")
                .select("*")
                .eq("league_id", leagueId)
                .eq("status", "approved");

            if (teamsData && teamsData.length > 0) {
                const teamIds = teamsData.map(team => team.id);

                // Fetch all team matches
                const { data: teamMatchesData } = await supabaseAuthenticated
                    .from("team_matches")
                    .select("*")
                    .eq("league_id", leagueId);

                const { data: rosterRows } = teamIds.length > 0
                    ? await supabaseAuthenticated
                        .from("team_members")
                        .select("team_id, player_id")
                        .in("team_id", teamIds)
                    : { data: [] as any[] };

                const membersByTeam = new Map<string, string[]>();
                (rosterRows || []).forEach((row: any) => {
                    const existing = membersByTeam.get(row.team_id) || [];
                    existing.push(row.player_id);
                    membersByTeam.set(row.team_id, existing);
                });
                    
                const tStats = teamsData.map(team => {
                    let wins = 0;
                    let losses = 0;
                    teamMatchesData?.forEach(m => {
                        if (m.team_a_id === team.id) {
                            wins += (m.wins_a || 0);
                            losses += (m.losses_a || 0);
                        } else if (m.team_b_id === team.id) {
                            wins += (m.wins_b || 0);
                            losses += (m.losses_b || 0);
                        }
                    });
                    const played = wins + losses;
                    const winRate = played > 0 ? ((wins / played) * 100).toFixed(1) : "0.0";
                    const memberIds = membersByTeam.get(team.id) || [];
                    const wins8 = memberIds.reduce((sum, playerId) => sum + (playerStatsMap.get(playerId)?.wins8 || 0), 0);
                    const played8 = memberIds.reduce((sum, playerId) => sum + (playerStatsMap.get(playerId)?.played8 || 0), 0);
                    const wins9 = memberIds.reduce((sum, playerId) => sum + (playerStatsMap.get(playerId)?.wins9 || 0), 0);
                    const played9 = memberIds.reduce((sum, playerId) => sum + (playerStatsMap.get(playerId)?.played9 || 0), 0);
                    const losses8 = Math.max(played8 - wins8, 0);
                    const losses9 = Math.max(played9 - wins9, 0);

                    return {
                        ...team,
                        wins,
                        losses,
                        played,
                        winRate: parseFloat(winRate),
                        record8: formatRecord(wins8, losses8),
                        pct8: formatPercent(wins8, played8),
                        record9: formatRecord(wins9, losses9),
                        pct9: formatPercent(wins9, played9),
                    };
                });
                
                tStats.sort((a, b) => b.winRate - a.winRate);
                const rankedTeams = tStats.map((s, i) => ({ ...s, rank: i + 1 }));
                setTeamLeaderboard(rankedTeams);
                
                // Switch to team view by default if it's the first load
                if (leaderboard.length === 0 && rankedTeams.length > 0) {
                    setViewMode('teams');
                }
            } else {
                setTeamLeaderboard([]);
            }

            // 3. Fetch Pre-Calculated Stats from league_players
            // This replaces the expensive client-side aggregation
            const { data: players } = await supabaseAuthenticated
                .from("league_players")
                .select("player_id, matches_played, matches_won, shutouts, breakpoint_racks_won, breakpoint_racks_played, profiles!inner(full_name, breakpoint_rating, is_active)")
                .eq("league_id", leagueId)
                .eq("profiles.is_active", true);

            if (players && players.length > 0) {
                const statsArray = players.map((p: any) => {
                    const name = p.profiles?.full_name || 'Unknown';
                    const rating = p.profiles?.breakpoint_rating ?? 500;
                    const played = p.matches_played || 0;
                    const wins = p.matches_won || 0;
                    const shutouts = p.shutouts || 0;
                    const racksWon = p.breakpoint_racks_won || 0;
                    const racksPlayed = p.breakpoint_racks_played || 0;
                    const typeStats = playerStatsMap.get(p.player_id) || { wins8: 0, played8: 0, wins9: 0, played9: 0 };
                    const losses8 = Math.max(typeStats.played8 - typeStats.wins8, 0);
                    const losses9 = Math.max(typeStats.played9 - typeStats.wins9, 0);

                    return {
                        id: p.player_id,
                        name,
                        wins,
                        played,
                        shutouts,
                        winRate: played > 0 ? Math.round((wins / played) * 100) : 0,
                        rackWinRate: racksPlayed > 0 ? (racksWon / racksPlayed) * 100 : 0,
                        record8: formatRecord(typeStats.wins8, losses8),
                        pct8: formatPercent(typeStats.wins8, typeStats.played8),
                        record9: formatRecord(typeStats.wins9, losses9),
                        pct9: formatPercent(typeStats.wins9, typeStats.played9),
                        breakPoint: getBreakpointLevel(rating),
                        rating // raw for tiebreak
                    };
                });

                statsArray.sort((a, b) => {
                    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                    return b.rackWinRate - a.rackWinRate; // Secondary: Rack win %
                });

                // Assign Rank
                const ranked = statsArray.map((s, i) => ({ ...s, rank: i + 1 }));
                setLeaderboard(ranked);
            } else {
                setLeaderboard([]);
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
    }, [userId, currentSession]);

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

            {teamLeaderboard.length > 0 && (
                <View className="px-4 py-3 bg-background border-b border-border/50 bg-surface/30">
                    <View className="flex-row bg-black/60 rounded-full p-1 border border-border/50">
                        <TouchableOpacity
                            onPress={() => setViewMode('teams')}
                            className={`flex-1 py-2 rounded-full items-center ${viewMode === 'teams' ? 'bg-primary' : ''}`}
                        >
                            <Text className={`font-bold text-xs uppercase tracking-wider ${viewMode === 'teams' ? 'text-black' : 'text-gray-400'}`}>Teams</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setViewMode('players')}
                            className={`flex-1 py-2 rounded-full items-center ${viewMode === 'players' ? 'bg-primary' : ''}`}
                        >
                            <Text className={`font-bold text-xs uppercase tracking-wider ${viewMode === 'players' ? 'text-black' : 'text-gray-400'}`}>Players</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

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
                        <Text className="w-36 ml-2 text-black font-bold text-sm">{viewMode === 'teams' ? 'TEAM' : 'PLAYER'}</Text>
                    </View>

                    {/* Right Header (Adaptive) */}
                    {isLargeScreen ? (
                        <View style={{ flex: 1, height: HEADER_HEIGHT }} className="flex-row items-center px-4">
                            <Text className="flex-1 text-center text-black font-bold text-sm">SP</Text>
                            <Text className="flex-1 text-center text-black font-bold text-sm">W%</Text>
                            <Text className="flex-1 text-center text-black font-bold text-sm">W-L</Text>
                            <Text className="flex-1 text-center text-black font-bold text-sm">8B</Text>
                            <Text className="flex-1 text-center text-black font-bold text-sm">9B</Text>
                            {viewMode === 'players' && <Text className="flex-1 text-center text-black font-bold text-sm">SO</Text>}
                            {viewMode === 'players' && <Text className="flex-1 text-center text-black font-bold text-sm" style={{ includeFontPadding: false }}>BP</Text>}
                        </View>
                    ) : (
                        <ScrollView
                            horizontal
                            ref={headerScrollViewRef}
                            scrollEnabled={false}
                            showsHorizontalScrollIndicator={false}
                            style={{ flex: 1 }}
                        >
                            <View style={{ width: viewMode === 'teams' ? TEAM_COL_WIDTH_FIXED : PLAYER_COL_WIDTH_FIXED, height: HEADER_HEIGHT }} className="flex-row items-center px-2">
                                <Text className="w-12 text-center text-black font-bold text-sm">SP</Text>
                                <Text className="w-14 text-center text-black font-bold text-sm">W%</Text>
                                <Text className="w-16 text-center text-black font-bold text-sm">W-L</Text>
                                <Text style={{ width: 70 }} className="text-center text-black font-bold text-sm">8B</Text>
                                <Text style={{ width: 70 }} className="text-center text-black font-bold text-sm">9B</Text>
                                {viewMode === 'players' && <Text className="w-12 text-center text-black font-bold text-sm">SO</Text>}
                                {viewMode === 'players' && <Text className="w-10 text-center text-black font-bold text-sm" style={{ includeFontPadding: false }}>BP</Text>}
                            </View>
                        </ScrollView>
                    )}
                </View>

                {/* 1. Body Container */}
                <View className="flex-row pb-24">
                    {/* Left Column Stack (Fixed) */}
                    <View style={{ width: LEFT_COL_WIDTH }} className="border-r border-border bg-background">
                        {(viewMode === 'players' ? leaderboard : teamLeaderboard).map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => viewMode === 'players' && router.push(`/player/${item.id}`)}
                                disabled={viewMode === 'teams' || item.id === userId}
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
                            {(viewMode === 'players' ? leaderboard : teamLeaderboard).map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => viewMode === 'players' && router.push(`/player/${item.id}`)}
                                    disabled={viewMode === 'teams' || item.id === userId}
                                    style={{ height: ROW_HEIGHT }}
                                    className={`flex-row items-center px-4 border-b border-border ${item.id === userId ? 'bg-surface-hover' : ''}`}
                                >
                                    <Text className="flex-1 text-center text-gray-400 font-bold text-sm">{item.played}</Text>
                                    <Text className="flex-1 text-center text-gray-300 font-bold text-sm">{item.winRate}%</Text>
                                    <Text className="flex-1 text-center text-foreground font-bold text-sm">{item.wins}-{item.played - item.wins}</Text>
                                    <Text className="flex-1 text-center text-foreground font-bold text-sm">{item.record8} {item.pct8}</Text>
                                    <Text className="flex-1 text-center text-foreground font-bold text-sm">{item.record9} {item.pct9}</Text>
                                    {viewMode === 'players' && <Text className="flex-1 text-center text-primary font-bold text-sm">{item.shutouts}</Text>}
                                    {viewMode === 'players' && <Text className="flex-1 text-center text-primary font-bold text-sm" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>{item.breakPoint} </Text>}
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
                            <View style={{ width: viewMode === 'teams' ? TEAM_COL_WIDTH_FIXED : PLAYER_COL_WIDTH_FIXED }}>
                                {(viewMode === 'players' ? leaderboard : teamLeaderboard).map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => viewMode === 'players' && router.push(`/player/${item.id}`)}
                                        disabled={viewMode === 'teams' || item.id === userId}
                                        style={{ height: ROW_HEIGHT }}
                                        className={`flex-row items-center px-2 border-b border-border ${item.id === userId ? 'bg-surface-hover' : ''}`}
                                    >
                                        <Text className="w-12 text-center text-gray-400 font-bold text-sm">{item.played}</Text>
                                        <Text className="w-14 text-center text-gray-300 font-bold text-sm">{item.winRate}%</Text>
                                        <Text className="w-16 text-center text-foreground font-bold text-sm">{item.wins}-{item.played - item.wins}</Text>
                                        <Text style={{ width: 70 }} className="text-center text-foreground font-bold text-sm">{item.record8} {item.pct8}</Text>
                                        <Text style={{ width: 70 }} className="text-center text-foreground font-bold text-sm">{item.record9} {item.pct9}</Text>
                                        {viewMode === 'players' && <Text className="w-12 text-center text-primary font-bold text-sm">{item.shutouts}</Text>}
                                        {viewMode === 'players' && <Text className="w-10 text-center text-primary font-bold text-sm" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>{item.breakPoint} </Text>}
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
