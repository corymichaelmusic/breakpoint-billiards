import { View, Text, SafeAreaView, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { createClient } from "@supabase/supabase-js";
import NextMatchCard from "../../components/NextMatchCard";

export default function MatchesScreen() {
    const { userId, getToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [matches, setMatches] = useState<any[]>([]);
    const [activeSession, setActiveSession] = useState<any>(null);

    const fetchMatches = useCallback(async () => {
        try {
            if (!userId) return;

            const token = await getToken({ template: 'supabase' });
            const supabaseAuthenticated = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            // 1. Fetch Active Session Logic (same as Dashboard)
            const { data: memberships } = await supabaseAuthenticated
                .from("league_players")
                .select(`
            league_id,
            leagues!inner (
                id,
                name,
                type,
                status,
                parent_league:parent_league_id(name)
            )
        `)
                .eq("player_id", userId)
                .eq("leagues.status", "active")
                .order("joined_at", { ascending: false });

            const activeMembership = memberships?.find((m: any) => m.leagues.type === 'session' && m.leagues.status === 'active')
                || memberships?.[0];

            if (activeMembership) {
                const session = activeMembership.leagues;
                setActiveSession(session);

                // 2. Fetch All Matches for this session
                const { data: fetchedMatches } = await supabaseAuthenticated
                    .from("matches")
                    .select(`
            *,
            player1:player1_id(full_name),
            player2:player2_id(full_name)
          `)
                    .eq("league_id", session.id)
                    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
                    .order("week_number", { ascending: true }) // Order by Week
                    .order("scheduled_date", { ascending: true });

                if (fetchedMatches) {
                    setMatches(fetchedMatches);
                }
            }
        } catch (error) {
            console.error("Error fetching matches:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId, getToken]);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchMatches();
    }, [fetchMatches]);

    if (loading) {
        return (
            <View className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator size="large" color="#D4AF37" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="px-4 py-4 bg-background border-b border-white/5 items-center">
                <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">Session Schedule</Text>
                <Text className="text-white text-2xl font-bold tracking-wider uppercase text-center">
                    {activeSession?.name || 'Schedule'}
                </Text>
                <Text className="text-primary font-bold tracking-widest uppercase text-sm mt-1">
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
                        // Logic for status/score calculation (Same as Dashboard)
                        const now = new Date();
                        const scheduledDate = new Date(match.scheduled_date);
                        const windowStart = new Date(scheduledDate);
                        windowStart.setHours(8, 0, 0, 0);
                        const windowEnd = new Date(windowStart);
                        windowEnd.setDate(windowEnd.getDate() + 1);

                        const isTimeOpen = now >= windowStart && now < windowEnd;

                        const isBothSetsFinalized = match.status_8ball === 'finalized' && match.status_9ball === 'finalized';
                        const totalPoints = (match.points_8ball_p1 || 0) + (match.points_8ball_p2 || 0) + (match.points_9ball_p1 || 0) + (match.points_9ball_p2 || 0);
                        const isStarted = totalPoints > 0;

                        let effectiveStatus = match.status;
                        if (match.status === 'finalized' || isBothSetsFinalized) {
                            effectiveStatus = 'finalized';
                        } else if (isStarted) {
                            effectiveStatus = 'in_progress';
                        }

                        const isMatchLocked = !match.is_manually_unlocked && !isTimeOpen && effectiveStatus !== 'finalized' && effectiveStatus !== 'in_progress';

                        const isP1 = match.player1_id === userId;
                        const scores = {
                            p1_8: match.points_8ball_p1 || 0,
                            p2_8: match.points_8ball_p2 || 0,
                            p1_9: match.points_9ball_p1 || 0,
                            p2_9: match.points_9ball_p2 || 0,
                            isPlayer1: isP1
                        };

                        return (
                            <NextMatchCard
                                key={match.id}
                                matchId={match.id}
                                opponentName={match.player1_id === userId ? match.player2?.full_name : match.player1?.full_name || 'Unknown'}
                                date={`Week ${match.week_number} • ${match.scheduled_date ? new Date(match.scheduled_date).toLocaleDateString() : 'TBD'}`}
                                isLocked={isMatchLocked}
                                weekNumber={match.week_number}
                                status={effectiveStatus}
                                player1Id={match.player1_id}
                                player2Id={match.player2_id}
                                paymentStatusP1={match.payment_status_p1}
                                paymentStatusP2={match.payment_status_p2}
                                label={`Week ${match.week_number}`}
                                scores={scores}
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
