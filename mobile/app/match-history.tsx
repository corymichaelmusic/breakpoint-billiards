import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5 } from "@expo/vector-icons";
import NextMatchCard from "../components/NextMatchCard";

const firstRelatedRow = (value: any) => Array.isArray(value) ? value[0] : value;

const getMatchHistoryTimestamp = (match: any) => {
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

const formatMatchHistoryDate = (match: any) => {
    const teamSet = firstRelatedRow(match.team_match_sets);
    const rawDate =
        match.scheduled_date ||
        teamSet?.team_match?.scheduled_date ||
        match.submitted_at ||
        match.created_at ||
        teamSet?.team_match?.created_at;

    if (!rawDate) return 'Date TBD';

    const date = new Date(rawDate);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() < 2000) {
        return 'Date TBD';
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

const mergeMatchHistoryRows = (rows: any[], targetId: string) => {
    const grouped = new Map<string, any>();

    rows.forEach((match) => {
        const teamSet = firstRelatedRow(match.team_match_sets);
        const opponentId = match.player1_id === targetId ? match.player2_id : match.player1_id;
        const groupedPlayerIds = [targetId, opponentId].sort().join(':');
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
                status_9ball: null,
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
            ...((match.games || []) as any[]),
        ];

        if (getMatchHistoryTimestamp(match) > getMatchHistoryTimestamp(existing)) {
            existing.scheduled_date = match.scheduled_date || teamSet?.team_match?.scheduled_date || existing.scheduled_date;
            existing.submitted_at = match.submitted_at || existing.submitted_at;
            existing.created_at = match.created_at || existing.created_at;
        }
    });

    return Array.from(grouped.values()).sort((a, b) => getMatchHistoryTimestamp(b) - getMatchHistoryTimestamp(a));
};

export default function MatchHistoryScreen() {
    const { userId, getToken } = useAuth();
    const router = useRouter();
    const { playerId: rawPlayerId } = useLocalSearchParams();
    const playerId = Array.isArray(rawPlayerId) ? rawPlayerId[0] : rawPlayerId;

    const [loading, setLoading] = useState(true);
    const [matches, setMatches] = useState<any[]>([]);
    const [playerName, setPlayerName] = useState<string>("");

    const targetId = playerId || userId;

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                if (!targetId) return;
                const token = await getToken({ template: 'supabase' });
                const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

                const supabase = createClient(
                    process.env.EXPO_PUBLIC_SUPABASE_URL!,
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    { global: { headers: authHeader } }
                );

                // If viewing someone else, fetch their name for the header
                if (playerId) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', playerId)
                        .single();
                    if (profile) setPlayerName(profile.full_name);
                }

                // Fetch ONLY FINISHED matches involving targetId
                const { data: fetchedMatches } = await supabase
                    .from("matches")
                    .select(`
                        *,
                        player1:player1_id(full_name),
                        player2:player2_id(full_name),
                        leagues(name, parent_league:parent_league_id(name)),
                        team_match_sets(
                            team_match_id,
                            set_number,
                            game_type,
                            team_match:team_match_id(scheduled_date, created_at)
                        ),
                        games (winner_id, is_break_and_run, is_rack_and_run, is_9_on_snap, game_type)
                    `)
                    .or(`player1_id.eq.${targetId},player2_id.eq.${targetId}`)
                    .or('status_8ball.eq.finalized,status_9ball.eq.finalized')
                    .order("scheduled_date", { ascending: false });

                if (fetchedMatches) setMatches(mergeMatchHistoryRows(fetchedMatches, targetId));
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [targetId, playerId]);

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* Header */}
            <View className="px-4 py-4 bg-background border-b border-white/5 flex-row justify-between items-center">
                <View className="flex-row items-center flex-1 mr-4">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2">
                        <FontAwesome5 name="arrow-left" size={20} color="#D4AF37" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-xl font-bold text-white uppercase tracking-wide" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                            Match History
                        </Text>
                        <Text className="text-gray-400 uppercase tracking-widest text-[10px]">
                            {playerId ? (playerName || 'Loading...') : 'All Sessions'}
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
                            const isP1 = match.player1_id === targetId;
                            const opponentName = isP1 ? (match.player2?.full_name || 'Unknown') : (match.player1?.full_name || 'Unknown');

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

                            // Calculate Special Stats Dynamically
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
                                    key={`${match.id}-${firstRelatedRow(match.team_match_sets)?.team_match_id || 'match'}`}
                                    matchId={match.id}
                                    opponentName={opponentName}
                                    viewerName={playerId ? playerName : undefined}
                                    date={formatMatchHistoryDate(match)}
                                    leagueName={match.leagues?.parent_league?.name}
                                    sessionName={match.leagues?.name}
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
