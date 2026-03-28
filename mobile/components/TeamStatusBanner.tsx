import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';

export default function TeamStatusBanner({ sessionId }: { sessionId: string }) {
    const { getToken, userId } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [team, setTeam] = useState<any>(null);
    const [isTeamLeague, setIsTeamLeague] = useState(false);

    useEffect(() => {
        if (!sessionId || !userId) return;

        const checkTeamStatus = async () => {
            setLoading(true);
            try {
                const token = await getToken({ template: 'supabase' });
                const supabase = createClient(
                    process.env.EXPO_PUBLIC_SUPABASE_URL!,
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    { global: { headers: { Authorization: `Bearer ${token}` } } }
                );

                // Check if session is a team league
                const { data: leagueData } = await supabase
                    .from('leagues')
                    .select('is_team_league')
                    .eq('id', sessionId)
                    .single();
                
                if (leagueData?.is_team_league) {
                    setIsTeamLeague(true);
                } else {
                    setIsTeamLeague(false);
                    return; // No need to check teams if it's not a team league
                }

                // Check if user is on a team in this session
                const { data, error } = await supabase
                    .from('team_members')
                    .select('teams(*)')
                    .eq('player_id', userId)
                    .single();

                const teamData: any = data?.teams;

                if (!error && teamData && !Array.isArray(teamData) && teamData.league_id === sessionId) {
                    setTeam(teamData);
                } else if (!error && teamData && !Array.isArray(teamData)) {
                     // Check if they are captain directly if members query didn't catch (edge cases)
                     const { data: capData } = await supabase
                         .from('teams')
                         .select('*')
                         .eq('league_id', sessionId)
                         .eq('captain_id', userId)
                         .single();
                     if (capData) setTeam(capData);
                } else {
                     // Not on a team via members. Are they a captain?
                     const { data: capData } = await supabase
                         .from('teams')
                         .select('*')
                         .eq('league_id', sessionId)
                         .eq('captain_id', userId)
                         .single();
                     if (capData) setTeam(capData);
                }
            } catch (e) {
                console.error("Team Check Error:", e);
            } finally {
                setLoading(false);
            }
        };

        checkTeamStatus();
    }, [sessionId, userId]);

    if (loading) {
        return <ActivityIndicator color="#D4AF37" size="small" style={{ marginVertical: 10 }} />;
    }

    if (team) {
        return (
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => router.push('/teams/manage')}
                className="bg-surface border border-primary/50 rounded-xl mt-4 mx-4 p-4 flex-row items-center justify-between"
            >
                <View className="flex-row items-center flex-1">
                    <FontAwesome5 name="users" size={20} color="#D4AF37" className="mr-3" />
                    <View className="flex-1 mr-2">
                        <Text className="text-white font-bold text-base" numberOfLines={1}>{team.name}</Text>
                        <Text className="text-gray-400 text-xs">Tap to manage your team roster</Text>
                    </View>
                </View>
                <FontAwesome5 name="chevron-right" size={14} color="#D4AF37" />
            </TouchableOpacity>
        );
    }

    if (!isTeamLeague) {
        return null; // Not a team league, hide entirely
    }

    return (
        <View className="bg-surface/50 border border-border rounded-xl mt-4 mx-4 p-4 flex-row items-center justify-between">
            <View className="flex-1 mr-3">
                <Text className="text-white font-bold text-sm mb-1">Playing in a Team League?</Text>
                <Text className="text-gray-400 text-xs leading-4">Create your team and invite players to get started.</Text>
            </View>
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => router.push('/teams/create')}
                className="bg-primary px-4 py-2 rounded-lg"
            >
                <Text className="text-black font-bold uppercase text-xs" style={{ includeFontPadding: false }}>Create</Text>
            </TouchableOpacity>
        </View>
    );
}
