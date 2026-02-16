import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { createClient } from "@supabase/supabase-js";
import NextMatchCard from "../../components/NextMatchCard";
import { fetchMatchRaces } from "../../utils/rating";
import { useSession } from "../../lib/SessionContext";
import { isMatchLocked } from "../../utils/match";

export default function MatchesScreen() {
    const { userId, getToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [matches, setMatches] = useState<any[]>([]);
    const [races, setRaces] = useState<Record<string, any>>({});
    const [activeSession, setActiveSession] = useState<any>(null);
    const lastFetchTime = useRef<number>(0);
    const CACHE_DURATION = 60000; // 60 seconds
    const { currentSession } = useSession();

    useFocusEffect(
        useCallback(() => {
            fetchMatches();
        }, [])
    );

    const fetchMatches = useCallback(async (force = false) => {
        const now = Date.now();
        if (!force && lastFetchTime.current > 0 && (now - lastFetchTime.current) < CACHE_DURATION && matches.length > 0) {
            console.log(" [Matches] Using cached data");
            setLoading(false);
            return;
        }

        try {
            if (!userId) return;
            console.log(" [Matches] Fetching new data...");
            lastFetchTime.current = now;

            const token = await getToken({ template: 'supabase' });
            // ... (rest of logic same)
            const supabaseAuthenticated = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            if (!currentSession) {
                setLoading(false);
                return;
            }

            // Use session from context
            setActiveSession(currentSession);

            // 2. Fetch All Matches for this session
            const { data: fetchedMatches } = await supabaseAuthenticated
                .from("matches")
                .select(`
            *,
            p1_submitted_at,
            p2_submitted_at,
            player1:player1_id(full_name, breakpoint_rating, fargo_rating),
            player2:player2_id(full_name, breakpoint_rating, fargo_rating),
            games (winner_id, is_break_and_run, is_9_on_snap, game_type)
          `)
                .eq("league_id", currentSession.id)
                .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
                .order("week_number", { ascending: true }) // Order by Week
                .order("scheduled_date", { ascending: true });

            if (fetchedMatches) {
                setMatches(fetchedMatches);

                // Bulk Fetch Races
                const inputs = fetchedMatches.map((m: any) => ({
                    id: m.id,
                    p1Rating: m.player1?.breakpoint_rating || 500,
                    p2Rating: m.player2?.breakpoint_rating || 500
                }));

                fetchMatchRaces(inputs).then(raceData => {
                    if (raceData) setRaces(raceData);
                });
            }
        } catch (error) {
            console.error("Error fetching matches:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId, getToken, currentSession]);

    // useEffect removed - replaced by useFocusEffect above

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchMatches(true);
    }, [fetchMatches]);

    if (loading) {
        return (
            <View className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator size="large" color="#D4AF37" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom', 'left', 'right']}>
            <View className="px-4 py-4 bg-background border-b border-white/5 items-center">
                <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1" style={{ includeFontPadding: false }}>Session Schedule </Text>
                <Text className="text-foreground text-2xl font-bold tracking-wider uppercase text-center" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                    {activeSession?.name || 'Schedule'}
                </Text>
                <Text className="text-primary font-bold tracking-widest uppercase text-sm mt-1" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                    {activeSession?.parent_league?.name || 'Matches'}
                </Text>
            </View>
            <ScrollView
                className="flex-1 px-4 pt-4"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {matches.length > 0 ? (
                    matches.map((match) => {
                        const isBothSetsFinalized = match.status_8ball === 'finalized' && match.status_9ball === 'finalized';
                        const totalPoints = (match.points_8ball_p1 || 0) + (match.points_8ball_p2 || 0) + (match.points_9ball_p1 || 0) + (match.points_9ball_p2 || 0);
                        const isStarted = totalPoints > 0;

                        let effectiveStatus = match.status;
                        if (match.status === 'finalized' || isBothSetsFinalized) {
                            effectiveStatus = 'finalized';
                        } else if (isStarted) {
                            effectiveStatus = 'in_progress';
                        }

                        const matchLocked = isMatchLocked(
                            match.scheduled_date,
                            activeSession?.timezone || 'America/Chicago',
                            match.is_manually_unlocked,
                            effectiveStatus,
                            isStarted
                        );

                        const isP1 = match.player1_id === userId;
                        const opponent = isP1 ? match.player2 : match.player1;
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

                        const matchRaces = races[match.id];
                        const racesForCard = matchRaces ? {
                            p1_8: matchRaces.race8.p1, p2_8: matchRaces.race8.p2,
                            p1_9: matchRaces.race9.p1, p2_9: matchRaces.race9.p2
                        } : undefined;

                        return (
                            <NextMatchCard
                                key={match.id}
                                matchId={match.id}
                                opponentName={opponent?.full_name || 'Unknown'}
                                opponentRating={opponent?.breakpoint_rating}
                                date={match.scheduled_date
                                    ? (() => {
                                        const datePart = match.scheduled_date.split('T')[0];
                                        const [year, month, day] = datePart.split('-').map(Number);
                                        return new Date(year, month - 1, day).toLocaleDateString();
                                    })()
                                    : 'TBD'}
                                isLocked={matchLocked}
                                weekNumber={undefined}
                                status={effectiveStatus}
                                player1Id={match.player1_id}
                                player2Id={match.player2_id}
                                paymentStatusP1={match.payment_status_p1}
                                paymentStatusP2={match.payment_status_p2}
                                label={`Week ${match.week_number}`}
                                scores={scores}
                                specialStats={specialStats}
                                verificationStatus={match.verification_status}
                                p1SubmittedAt={match.p1_submitted_at}
                                p2SubmittedAt={match.p2_submitted_at}
                                races={racesForCard}
                                scheduledTime={match.scheduled_time}
                                tableName={match.table_name}
                            />
                        );
                    })
                ) : (
                    <Text className="text-gray-500 text-center italic mt-10">No matches found for this session.</Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
