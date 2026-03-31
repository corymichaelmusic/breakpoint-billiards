import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { createClient } from "@supabase/supabase-js";
import NextMatchCard from "../../components/NextMatchCard";
import TeamMatchCard from "../../components/TeamMatchCard";
import { fetchMatchRaces } from "../../utils/rating";
import { useSession } from "../../lib/SessionContext";
import { isMatchLocked } from "../../utils/match";

type MatchGame = {
    winner_id?: string | null;
    is_break_and_run?: boolean | null;
    is_9_on_snap?: boolean | null;
    game_type?: string | null;
    game_number?: number | null;
    scored_by?: string | null;
};

const getDisplayGames = (games: MatchGame[] | null | undefined, userId: string) => {
    if (!games?.length) return [];

    const myGames = games.filter((game) => game.scored_by === userId);
    if (myGames.length > 0) return myGames;

    const seen = new Set<string>();
    return games.filter((game) => {
        const key = [
            game.game_type ?? "",
            game.game_number ?? "",
            game.winner_id ?? "",
            game.is_break_and_run ? "1" : "0",
            game.is_9_on_snap ? "1" : "0",
        ].join(":");

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

export default function MatchesScreen() {
    const { userId, getToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [matches, setMatches] = useState<any[]>([]);
    const [teamMatches, setTeamMatches] = useState<any[]>([]);
    const [userTeamId, setUserTeamId] = useState<string | null>(null);
    const [races, setRaces] = useState<Record<string, any>>({});
    const lastFetchTime = useRef<number>(0);
    const lastFetchedSessionId = useRef<string | null>(null);
    const CACHE_DURATION = 60000; // 60 seconds
    const { currentSession } = useSession();

    useEffect(() => {
        setLoading(true);
        setMatches([]);
        setTeamMatches([]);
        setUserTeamId(null);
        setRaces({});
        lastFetchTime.current = 0;
        lastFetchedSessionId.current = null;
    }, [currentSession?.id]);

    const fetchMatches = useCallback(async (force = false) => {
        const now = Date.now();
        const sessionChanged = currentSession?.id !== lastFetchedSessionId.current;

        if (!force && !sessionChanged && lastFetchTime.current > 0 && (now - lastFetchTime.current) < CACHE_DURATION && matches.length > 0) {
            console.log(" [Matches] Using cached data");
            setLoading(false);
            return;
        }

        try {
            if (!userId) return;
            console.log(" [Matches] Fetching new data...");
            lastFetchTime.current = now;
            lastFetchedSessionId.current = currentSession?.id || null;

            const token = await getToken({ template: 'supabase' });
            // ... (rest of logic same)
            const supabaseAuthenticated = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            if (!currentSession) {
                setMatches([]);
                setTeamMatches([]);
                setUserTeamId(null);
                setRaces({});
                setLoading(false);
                return;
            }

            // 2. Fetch All Matches for this session
            const { data: fetchedMatches } = await supabaseAuthenticated
                .from("matches")
                .select(`
            *,
            p1_submitted_at,
            p2_submitted_at,
            player1:player1_id(full_name, breakpoint_rating, fargo_rating),
            player2:player2_id(full_name, breakpoint_rating, fargo_rating),
            games (winner_id, is_break_and_run, is_9_on_snap, game_type, game_number, scored_by)
          `)
                .eq("league_id", currentSession.id)
                .eq('is_team_match_set', false)
                .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
                .order("week_number", { ascending: true }) // Order by Week
                .order("scheduled_date", { ascending: true });

            // 3. Fetch User's Team and Team Matches
            const { data: myTeamData } = await supabaseAuthenticated
                .from('team_members')
                .select('teams(id)')
                .eq('player_id', userId)
                .single();
            
            const tData: any = myTeamData?.teams;
            const uTeamId = tData?.id || null;
            setUserTeamId(uTeamId);

            if (uTeamId) {
                const { data: tmData } = await supabaseAuthenticated
                    .from('team_matches')
                    .select('*, team_a:team_a_id(*), team_b:team_b_id(*)')
                    .eq('league_id', currentSession.id)
                    .or(`team_a_id.eq.${uTeamId},team_b_id.eq.${uTeamId}`)
                    .order('week_number', { ascending: true })
                    .order('created_at', { ascending: true });
                
                if (tmData) {
                    setTeamMatches(tmData);
                } else {
                    setTeamMatches([]);
                }
            } else {
                setTeamMatches([]);
            }

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

    useFocusEffect(
        useCallback(() => {
            fetchMatches();
        }, [fetchMatches])
    );

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
                    {currentSession?.name || 'Schedule'}
                </Text>
                <Text className="text-primary font-bold tracking-widest uppercase text-sm mt-1" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                    {currentSession?.parentLeagueName || 'Matches'}
                </Text>
            </View>
            <ScrollView
                className="flex-1 px-4 pt-4"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {teamMatches.length > 0 && (
                    <View className="mb-6">
                        <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-3 pl-2">Team Matches</Text>
                        {teamMatches.map(tm => (
                            <TeamMatchCard key={tm.id} match={tm} userTeamId={userTeamId!} />
                        ))}
                    </View>
                )}

                {matches.length > 0 && (
                    <View>
                        {teamMatches.length > 0 && <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-3 pl-2">Individual Matches</Text>}
                        {matches.map((match) => {
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
                            currentSession?.timezone || 'America/Chicago',
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

                        const displayGames = getDisplayGames(match.games, userId);

                        if (displayGames.length > 0) {
                            displayGames.forEach((g: MatchGame) => {
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
                    })}
                    </View>
                )}

                {matches.length === 0 && teamMatches.length === 0 && (
                    <Text className="text-gray-500 text-center italic mt-10">No matches found for this session.</Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
