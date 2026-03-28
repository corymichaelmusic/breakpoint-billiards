import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';
import { useSession } from '../../lib/SessionContext';

export default function TeamsScreen() {
    const { userId, getToken } = useAuth();
    const { currentSession } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isTeamLeague, setIsTeamLeague] = useState(false);
    const [team, setTeam] = useState<any>(null);
    const [captainRequest, setCaptainRequest] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchTeamStatus = useCallback(async () => {
        if (!userId || !currentSession?.id) { setLoading(false); return; }

        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            // Check if this is a team session
            const { data: leagueData } = await supabase
                .from('leagues')
                .select('is_team_league')
                .eq('id', currentSession.id)
                .single();

            if (!leagueData?.is_team_league) {
                setIsTeamLeague(false);
                setLoading(false);
                setRefreshing(false);
                return;
            }
            setIsTeamLeague(true);

            // Check if player is on a team (as captain or member)
            const { data: capTeam } = await supabase
                .from('teams')
                .select('*')
                .eq('league_id', currentSession.id)
                .eq('captain_id', userId)
                .maybeSingle();

            if (capTeam) { setTeam(capTeam); setLoading(false); setRefreshing(false); return; }

            const { data: memberData } = await supabase
                .from('team_members')
                .select('teams!inner(*)')
                .eq('player_id', userId)
                .eq('teams.league_id', currentSession.id)
                .maybeSingle();

            const memberTeam: any = memberData?.teams;
            if (memberTeam && !Array.isArray(memberTeam)) {
                setTeam(memberTeam);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            setTeam(null);

            // Check if they have a pending captain request
            const { data: reqData } = await supabase
                .from('captain_requests')
                .select('*')
                .eq('league_id', currentSession.id)
                .eq('player_id', userId)
                .maybeSingle();

            setCaptainRequest(reqData || null);
        } catch (e) {
            console.error('TeamsScreen error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId, currentSession?.id, getToken]);

    useFocusEffect(useCallback(() => { fetchTeamStatus(); }, [fetchTeamStatus]));

    const handleRequestCaptain = async () => {
        if (!userId || !currentSession?.id) return;
        setSubmitting(true);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );
            const { error } = await supabase
                .from('captain_requests')
                .upsert({ league_id: currentSession.id, player_id: userId, status: 'pending' }, { onConflict: 'league_id,player_id' });
            if (error) throw error;
            Alert.alert('Request Sent!', 'Your captain request has been sent to the league operator. You\'ll be notified once it\'s reviewed.');
            await fetchTeamStatus();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to send request.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator color="#D4AF37" />
            </SafeAreaView>
        );
    }

    if (!currentSession) {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
                <FontAwesome5 name="users" size={40} color="#444" />
                <Text className="text-gray-500 text-center mt-4">Join a session to view your team.</Text>
            </SafeAreaView>
        );
    }

    if (!isTeamLeague) {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
                <FontAwesome5 name="users" size={40} color="#333" />
                <Text className="text-gray-600 text-center mt-4 text-base">Teams are only available in team league sessions.</Text>
                <Text className="text-gray-700 text-center mt-2 text-sm">Switch to a team session to view and manage teams.</Text>
            </SafeAreaView>
        );
    }

    // On a team
    if (team) {
        return (
            <SafeAreaView className="flex-1 bg-background" edges={['bottom', 'left', 'right']}>
                <ScrollView
                    className="flex-1 px-4"
                    contentContainerStyle={{ paddingTop: 20, paddingBottom: 80 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTeamStatus(); }} tintColor="#D4AF37" />}
                >
                    <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">Your Team</Text>
                    <Text className="text-white text-2xl font-bold mb-6">{team.name}</Text>

                    <TouchableOpacity
                        onPress={() => router.push('/teams/manage')}
                        className="bg-primary rounded-xl p-5 mb-4 flex-row items-center justify-between"
                        activeOpacity={0.8}
                    >
                        <View className="flex-row items-center gap-3">
                            <FontAwesome5 name="users" size={20} color="#000" />
                            <Text className="text-black font-bold text-base">Manage Roster</Text>
                        </View>
                        <FontAwesome5 name="chevron-right" size={14} color="#000" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/teams/create')}
                        className="bg-surface border border-border rounded-xl p-5 flex-row items-center justify-between"
                        activeOpacity={0.8}
                    >
                        <View className="flex-row items-center gap-3">
                            <FontAwesome5 name="edit" size={18} color="#D4AF37" />
                            <Text className="text-white font-bold text-base">Edit Team</Text>
                        </View>
                        <FontAwesome5 name="chevron-right" size={14} color="#666" />
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Not on a team — show captain request CTA
    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom', 'left', 'right']}>
            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 40, paddingBottom: 80 }}>
                <View className="items-center mb-10">
                    <View className="bg-primary/10 border border-primary/30 rounded-full w-24 h-24 items-center justify-center mb-6">
                        <FontAwesome5 name="crown" size={36} color="#D4AF37" />
                    </View>
                    <Text className="text-white text-2xl font-bold mb-2 text-center">Become a Team Captain</Text>
                    <Text className="text-gray-400 text-sm text-center leading-5 px-4">
                        As a captain, you'll build your roster, manage your lineup, and lead your team through the season.
                    </Text>
                </View>

                {captainRequest ? (
                    <View className="bg-surface border border-primary/30 rounded-xl p-5 items-center mb-4">
                        <FontAwesome5 name="clock" size={22} color="#D4AF37" className="mb-3" />
                        <Text className="text-primary font-bold text-base mt-3 mb-1">Request Pending</Text>
                        <Text className="text-gray-400 text-sm text-center">Your captain request has been sent to the operator and is awaiting review.</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={handleRequestCaptain}
                        disabled={submitting}
                        className="bg-primary rounded-xl p-5 items-center mb-4"
                        activeOpacity={0.8}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text className="text-black font-bold text-base uppercase tracking-wider">Send Captain Request</Text>
                        )}
                    </TouchableOpacity>
                )}

                <View className="bg-surface border border-border rounded-xl p-5 mt-2">
                    <Text className="text-primary font-bold text-sm mb-3 uppercase tracking-wider">Captain Responsibilities</Text>
                    {[
                        { icon: 'user-friends', text: 'Build and manage a 5-player roster' },
                        { icon: 'chess-king', text: 'Put up players for each match set' },
                        { icon: 'star', text: 'Manage your 25 Breakpoint Rating cap' },
                    ].map((item, i) => (
                        <View key={i} className="flex-row items-center gap-3 mb-3">
                            <FontAwesome5 name={item.icon as any} size={16} color="#D4AF37" style={{ width: 20 }} />
                            <Text className="text-gray-300 text-sm flex-1">{item.text}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
