import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { getBreakpointLevel } from '../../utils/rating';

export default function MatchResultsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { userId, getToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [match, setMatch] = useState<any>(null);
    const [stats, setStats] = useState<any>({
        p1: { bnr8: 0, bnr9: 0, rnr: 0, snaps: 0 },
        p2: { bnr8: 0, bnr9: 0, rnr: 0, snaps: 0 }
    });

    useEffect(() => {
        fetchResults();
    }, [id]);

    const fetchResults = async () => {
        try {
            if (!id) return;
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            // Fetch Match & Players
            const { data: matchData, error } = await supabase
                .from('matches')
                .select(`
                    *,
                    player1:player1_id (id, full_name, avatar_url, breakpoint_rating),
                    player2:player2_id (id, full_name, avatar_url, breakpoint_rating),
                    league:league_id (name)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            // Fetch Games for Stats Calculation
            const { data: games } = await supabase
                .from('games')
                .select('*')
                .eq('match_id', id);

            // Calculate Stats
            const newStats = {
                p1: { bnr8: 0, bnr9: 0, rnr: 0, snaps: 0 },
                p2: { bnr8: 0, bnr9: 0, rnr: 0, snaps: 0 }
            };

            if (games) {
                games.forEach(g => {
                    // Check if Player 1 Won
                    const p1Won8 = g.winner_id === matchData.player1_id && g.game_type === '8ball';
                    const p1Won9 = g.winner_id === matchData.player1_id && g.game_type === '9ball';
                    const p2Won8 = g.winner_id === matchData.player2_id && g.game_type === '8ball';
                    const p2Won9 = g.winner_id === matchData.player2_id && g.game_type === '9ball';

                    // Break & Runs (break_and_run flag)
                    if (g.break_and_run) {
                        if (p1Won8) newStats.p1.bnr8++;
                        if (p1Won9) newStats.p1.bnr9++;
                        if (p2Won8) newStats.p2.bnr8++;
                        if (p2Won9) newStats.p2.bnr9++;
                    }

                    // Rack & Runs (not break & run, but run out from first inning? - Complex, logic usually relies on 'table_run' or similar if tracked)
                    // Assuming 'table_run' or we just skip if not explicitly tracked in games columns yet.
                    // Checking schema: games usually has break_and_run, nine_on_snap. 

                    // 9-on-Snap
                    if (g.nine_on_snap) {
                        if (p1Won9) newStats.p1.snaps++; // Usually winner gets it, but technically even if they lose? No, snap wins the game.
                        if (p2Won9) newStats.p2.snaps++;
                    }
                });
            }

            setMatch(matchData);
            setStats(newStats);

        } catch (e) {
            console.error("Error fetching results:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator size="large" color="#D4AF37" />
            </View>
        );
    }

    if (!match) return <View className="flex-1 bg-background"><Text className="text-white text-center mt-10">Match not found.</Text></View>;

    const isP1User = match.player1_id === userId;
    // Determine visual orientation: User always on Left if possible? 
    // Or just Keep P1 Left, P2 Right. Let's keep P1 Left for consistency with scores.

    const p1Score8 = match.points_8ball_p1 || 0;
    const p2Score8 = match.points_8ball_p2 || 0;
    const p1Score9 = match.points_9ball_p1 || 0;
    const p2Score9 = match.points_9ball_p2 || 0;

    const p1Total = p1Score8 + p1Score9;
    const p2Total = p2Score8 + p2Score9;

    const winnerId8 = match.winner_id_8ball;
    const winnerId9 = match.winner_id_9ball;

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="px-4 py-4 border-b border-border flex-row items-center justify-between bg-surface-hover">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <Ionicons name="close" size={24} color="#D4AF37" />
                </TouchableOpacity>
                <View className="items-center">
                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest">Match Results</Text>
                    <Text className="text-white font-bold text-sm tracking-wider">{match.league?.name}</Text>
                </View>
                <View className="w-8" />
            </View>

            <ScrollView className="flex-1 p-4">

                {/* Scoreboard */}
                <View className="flex-row justify-between items-center mb-8 bg-surface p-4 rounded-xl border border-border">
                    {/* Player 1 */}
                    <View className="items-center flex-1">
                        <View className="w-16 h-16 rounded-full bg-surface-hover items-center justify-center mb-2 border border-border">
                            {match.player1.avatar_url ? (
                                <Image source={{ uri: match.player1.avatar_url }} className="w-16 h-16 rounded-full" />
                            ) : (
                                <FontAwesome5 name="user" size={32} color="#666" />
                            )}
                        </View>
                        <Text className="text-white font-bold text-center mb-1" numberOfLines={1}>
                            {match.player1.full_name?.split(' ')[0]}
                        </Text>
                        <View className="bg-primary/20 px-3 py-1 rounded-full">
                            <Text className="text-primary text-xs font-bold uppercase">
                                Level {getBreakpointLevel(match.player1.breakpoint_rating)}
                            </Text>
                        </View>
                    </View>

                    {/* VS / Info */}
                    <View className="items-center px-4">
                        <Text className="text-gray-500 font-bold text-xs uppercase mb-1">Final</Text>
                        <View className="h-8 w-[1px] bg-border mb-1" />
                        <Text className="text-gray-400 text-xs">Week {match.week_number}</Text>
                    </View>

                    {/* Player 2 */}
                    <View className="items-center flex-1">
                        <View className="w-16 h-16 rounded-full bg-surface-hover items-center justify-center mb-2 border border-border">
                            {match.player2.avatar_url ? (
                                <Image source={{ uri: match.player2.avatar_url }} className="w-16 h-16 rounded-full" />
                            ) : (
                                <FontAwesome5 name="user" size={32} color="#666" />
                            )}
                        </View>
                        <Text className="text-white font-bold text-center mb-1" numberOfLines={1}>
                            {match.player2.full_name?.split(' ')[0]}
                        </Text>
                        <View className="bg-primary/20 px-3 py-1 rounded-full">
                            <Text className="text-primary text-xs font-bold uppercase">
                                Level {getBreakpointLevel(match.player2.breakpoint_rating)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Set Breakdown */}
                <View className="mb-6">
                    <View className="flex-row justify-between mb-2 px-2">
                        <Text className="text-gray-400 font-bold text-xs uppercase w-20">Set</Text>
                        <Text className="text-gray-400 font-bold text-xs uppercase text-center flex-1">{match.player1.full_name?.split(' ')[0]}</Text>
                        <Text className="text-gray-400 font-bold text-xs uppercase text-center flex-1">{match.player2.full_name?.split(' ')[0]}</Text>
                    </View>

                    {/* 8-Ball Row */}
                    <View className="flex-row justify-between items-center bg-surface p-3 rounded-lg mb-2 border border-border">
                        <View className="w-20 flex-row items-center">
                            <View className="w-6 h-6 rounded-full bg-black items-center justify-center border border-gray-700 mr-2">
                                <Text className="text-white text-[10px] font-bold">8</Text>
                            </View>
                            <Text className="text-white font-bold">8-Ball</Text>
                        </View>
                        <Text className={`flex-1 text-center font-bold text-lg ${match.winner_id_8ball === match.player1_id ? 'text-green-400' : 'text-gray-400'}`}>
                            {p1Score8}
                        </Text>
                        <Text className={`flex-1 text-center font-bold text-lg ${match.winner_id_8ball === match.player2_id ? 'text-green-400' : 'text-gray-400'}`}>
                            {p2Score8}
                        </Text>
                    </View>

                    {/* 9-Ball Row */}
                    <View className="flex-row justify-between items-center bg-surface p-3 rounded-lg border border-border">
                        <View className="w-20 flex-row items-center">
                            <View className="w-6 h-6 rounded-full bg-yellow-400 items-center justify-center border border-yellow-600 mr-2">
                                <Text className="text-black text-[10px] font-bold">9</Text>
                            </View>
                            <Text className="text-white font-bold">9-Ball</Text>
                        </View>
                        <Text className={`flex-1 text-center font-bold text-lg ${match.winner_id_9ball === match.player1_id ? 'text-green-400' : 'text-gray-400'}`}>
                            {p1Score9}
                        </Text>
                        <Text className={`flex-1 text-center font-bold text-lg ${match.winner_id_9ball === match.player2_id ? 'text-green-400' : 'text-gray-400'}`}>
                            {p2Score9}
                        </Text>
                    </View>
                </View>

                {/* Accomplishments */}
                <Text className="text-gray-400 font-bold text-xs uppercase mb-3 px-2 tracking-widest">Session Highlights</Text>

                <View className="bg-surface rounded-xl border border-border overflow-hidden mb-8">
                    <View className="flex-row bg-surface-hover p-3 border-b border-border">
                        <Text className="flex-1 text-gray-400 font-bold text-xs uppercase">Stat</Text>
                        <Text className="flex-1 text-center text-gray-400 font-bold text-xs uppercase">{match.player1.full_name?.split(' ')[0]}</Text>
                        <Text className="flex-1 text-center text-gray-400 font-bold text-xs uppercase">{match.player2.full_name?.split(' ')[0]}</Text>
                    </View>

                    {/* 8-Ball B&R */}
                    <View className="flex-row p-3 border-b border-white/5 items-center">
                        <Text className="flex-1 text-white font-bold text-xs">8-Ball Break & Run</Text>
                        <Text className={`flex-1 text-center font-bold ${stats.p1.bnr8 > 0 ? 'text-primary' : 'text-gray-600'}`}>{stats.p1.bnr8}</Text>
                        <Text className={`flex-1 text-center font-bold ${stats.p2.bnr8 > 0 ? 'text-primary' : 'text-gray-600'}`}>{stats.p2.bnr8}</Text>
                    </View>

                    {/* 9-Ball B&R */}
                    <View className="flex-row p-3 border-b border-white/5 items-center">
                        <Text className="flex-1 text-white font-bold text-xs">9-Ball Break & Run</Text>
                        <Text className={`flex-1 text-center font-bold ${stats.p1.bnr9 > 0 ? 'text-primary' : 'text-gray-600'}`}>{stats.p1.bnr9}</Text>
                        <Text className={`flex-1 text-center font-bold ${stats.p2.bnr9 > 0 ? 'text-primary' : 'text-gray-600'}`}>{stats.p2.bnr9}</Text>
                    </View>

                    {/* 9-on-Snap */}
                    <View className="flex-row p-3 items-center">
                        <Text className="flex-1 text-white font-bold text-xs">9-on-the-Snap</Text>
                        <Text className={`flex-1 text-center font-bold ${stats.p1.snaps > 0 ? 'text-green-400' : 'text-gray-600'}`}>{stats.p1.snaps}</Text>
                        <Text className={`flex-1 text-center font-bold ${stats.p2.snaps > 0 ? 'text-green-400' : 'text-gray-600'}`}>{stats.p2.snaps}</Text>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
