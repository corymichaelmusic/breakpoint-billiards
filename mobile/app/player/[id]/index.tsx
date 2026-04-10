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

const firstRelatedRow = (value: any) => Array.isArray(value) ? value[0] : value;

const getMatchTimestamp = (match: any) => {
    const teamSet = firstRelatedRow(match.team_match_sets);
    const rawDate =
        match.scheduled_date ||
        teamSet?.team_match?.scheduled_date ||
        match.submitted_at ||
        match.created_at ||
        teamSet?.created_at ||
        teamSet?.team_match?.created_at ||
        null;

    if (!rawDate) return 0;
    const time = new Date(rawDate).getTime();
    return Number.isFinite(time) ? time : 0;
};

const formatMatchDate = (match: any) => {
    const teamSet = firstRelatedRow(match.team_match_sets);
    const rawDate = match.scheduled_date || teamSet?.team_match?.scheduled_date || match.submitted_at || match.created_at || teamSet?.team_match?.created_at;
    if (!rawDate) return "Date TBD";

    const date = new Date(rawDate);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() < 2000) {
        return "Date TBD";
    }

    return date.toLocaleDateString();
};

const hasEightBallResult = (match: any) => {
    const teamSet = firstRelatedRow(match.team_match_sets);
    return teamSet?.game_type === '8ball' ||
        match.status_8ball === 'finalized' ||
        !!match.winner_id_8ball ||
        Number(match.points_8ball_p1 || 0) > 0 ||
        Number(match.points_8ball_p2 || 0) > 0;
};

const hasNineBallResult = (match: any) => {
    const teamSet = firstRelatedRow(match.team_match_sets);
    return teamSet?.game_type === '9ball' ||
        match.status_9ball === 'finalized' ||
        !!match.winner_id_9ball ||
        Number(match.points_9ball_p1 || 0) > 0 ||
        Number(match.points_9ball_p2 || 0) > 0;
};

const mergeH2HMatches = (rows: any[]) => {
    const grouped = new Map<string, any>();

    rows.forEach((match) => {
        const teamSet = firstRelatedRow(match.team_match_sets);
        const groupedPlayerIds = [match.player1_id, match.player2_id].sort().join(':');
        const key = teamSet?.team_match_id
            ? `team:${teamSet.team_match_id}:${groupedPlayerIds}`
            : `match:${match.id}`;

        if (!grouped.has(key)) {
            grouped.set(key, {
                ...match,
                games: [],
                show8Ball: false,
                show9Ball: false,
                points_8ball_p1: 0,
                points_8ball_p2: 0,
                points_9ball_p1: 0,
                points_9ball_p2: 0,
                winner_id_8ball: null,
                winner_id_9ball: null,
                status_8ball: null,
                status_9ball: null
            });
        }

        const existing = grouped.get(key);
        const show8Ball = hasEightBallResult(match);
        const show9Ball = hasNineBallResult(match);

        if (show8Ball) {
            existing.show8Ball = true;
            existing.points_8ball_p1 = match.points_8ball_p1 || 0;
            existing.points_8ball_p2 = match.points_8ball_p2 || 0;
            existing.winner_id_8ball = match.winner_id_8ball;
            existing.status_8ball = match.status_8ball || 'finalized';
        }

        if (show9Ball) {
            existing.show9Ball = true;
            existing.points_9ball_p1 = match.points_9ball_p1 || 0;
            existing.points_9ball_p2 = match.points_9ball_p2 || 0;
            existing.winner_id_9ball = match.winner_id_9ball;
            existing.status_9ball = match.status_9ball || 'finalized';
        }

        existing.games = [
            ...(existing.games || []),
            ...((match.games || []) as any[])
        ];

        if (getMatchTimestamp(match) > getMatchTimestamp(existing)) {
            existing.scheduled_date = match.scheduled_date || teamSet?.team_match?.scheduled_date || existing.scheduled_date;
            existing.submitted_at = match.submitted_at || existing.submitted_at;
            existing.created_at = match.created_at || existing.created_at;
        }
    });

    return Array.from(grouped.values()).sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a));
};

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
                    games (winner_id, is_break_and_run, is_rack_and_run, is_9_on_snap, game_type),
                    team_match_sets(
                        team_match_id,
                        set_number,
                        game_type,
                        team_match:team_match_id(scheduled_date, created_at)
                    )
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

            const displayMatches = mergeH2HMatches(h2hMatches);

            setMatches(displayMatches);

            // 3. Calculate Stats
            let wins = 0;
            let losses = 0;

            displayMatches.forEach(m => {
                const isP1 = m.player1_id === userId;

                // 8-Ball
                if (m.show8Ball && m.status_8ball === 'finalized') {
                    if (m.winner_id_8ball === userId) wins++;
                    else if (m.winner_id_8ball === id) losses++;
                }
                // 9-Ball
                if (m.show9Ball && m.status_9ball === 'finalized') {
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
                                isPlayer1: isP1,
                                show8Ball: match.show8Ball,
                                show9Ball: match.show9Ball
                            };

                            // Calculate Special Stats
                            let p1_8br = 0, p2_8br = 0;
                            let p1_8rr = 0, p2_8rr = 0;
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
                                    if (g.game_type === '8ball' && g.is_rack_and_run) {
                                        if (g.winner_id === match.player1_id) p1_8rr++;
                                        else if (g.winner_id === match.player2_id) p2_8rr++;
                                    }
                                });
                            }

                            const specialStats = {
                                p1_8br, p2_8br,
                                p1_8rr, p2_8rr,
                                p1_9br, p2_9br,
                                p1_snap, p2_snap
                            };

                            return (
                                <NextMatchCard
                                    key={`${match.id}-${match.team_match_sets?.[0]?.team_match_id || 'match'}`}
                                    matchId={match.id}
                                    opponentName={isP1 ? (match.player2?.full_name || profile?.full_name) : (match.player1?.full_name || profile?.full_name)}
                                    date={formatMatchDate(match)}
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
