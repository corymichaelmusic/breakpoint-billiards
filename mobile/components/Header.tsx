
import React, { useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, SafeAreaView, Platform, StatusBar, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { getBreakpointLevel } from '../utils/rating';
import { Ionicons } from '@expo/vector-icons';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export default function Header() {
    const router = useRouter();
    const { userId, getToken } = useAuth();
    const [nickname, setNickname] = useState<string>('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [rating, setRating] = useState<{ level: string, confidence: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [retried, setRetried] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!userId) return;
            try {
                const token = await getToken({ template: 'supabase' });
                const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;
                const supabase = createClient(supabaseUrl, supabaseAnonKey, {
                    global: { headers: authHeader }
                });

                const { data, error } = await supabase
                    .from('profiles')
                    .select('nickname, full_name, fargo_rating, breakpoint_rating, avatar_url')
                    .eq('id', userId)
                    .single();

                console.log("Header Profile Data:", data);

                if (data) {
                    const displayName = data.nickname || (data.full_name ? data.full_name.split(' ')[0] : 'User') || 'User';

                    // Simple Retry Logic: If we got "User" or "Player", maybe the DB wasn't ready. Try again once.
                    if ((displayName === 'User' || displayName === 'Player') && !retried) {
                        console.log("Header: Name is generic, retrying in 1s...");
                        setRetried(true);
                        setTimeout(fetchProfile, 1000);
                        return;
                    }

                    // Check breakpoint_rating first, then fall back to fargo_rating, then 500
                    // Fetch Confidence (Total Racks Played)
                    const { data: leagueStats } = await supabase
                        .from('league_players')
                        .select('breakpoint_racks_played')
                        .eq('player_id', userId);

                    const confidence = leagueStats
                        ? leagueStats.reduce((sum, item) => sum + (item.breakpoint_racks_played || 0), 0)
                        : 0;

                    const displayRating = data.breakpoint_rating || data.fargo_rating || 500;
                    const formattedRating = getBreakpointLevel(displayRating);

                    setNickname(displayName);
                    setAvatarUrl(data.avatar_url);
                    setRating({ level: formattedRating, confidence });
                } else {
                    console.log("Header: No profile data found for", userId);
                    setNickname("User");
                }
            } catch (error) {
                console.error("Error fetching header profile:", error);
                setNickname("User");
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();

        // Listen for updates from Profile Screen
        const subscription = DeviceEventEmitter.addListener('refreshProfile', fetchProfile);

        return () => {
            subscription.remove();
        };
    }, [userId]);

    return (
        <SafeAreaView className="bg-surface pb-4 pt-2">
            <View className="flex-row items-center justify-between px-6 h-20">
                {/* Left: User Info */}
                <View className="flex-1 flex-row items-center">
                    {loading ? (
                        <ActivityIndicator size="small" color="#D4AF37" />
                    ) : (
                        <View className="flex-row items-center">
                            {/* Avatar Thumbnail */}
                            <View className="w-10 h-10 rounded-full bg-surface border border-primary mr-3 overflow-hidden items-center justify-center">
                                {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} className="w-full h-full" />
                                ) : (
                                    <Ionicons name="person" size={20} color="#D4AF37" />
                                )}
                            </View>

                            <View>
                                <Text className="text-white font-bold text-xl mb-1">
                                    Hello, <Text className="text-primary">{nickname}</Text>
                                </Text>
                                <View className="flex-row items-center">
                                    <Text className="text-gray-400 text-sm font-bold tracking-wider">
                                        BP: <Text className="text-primary text-base">{rating?.level || '-'}</Text>
                                        <Text className="text-gray-500 text-xs"> ({rating?.confidence || 0})</Text>
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* Right: Logo */}
                <View>
                    <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
                        <Image
                            source={require('../assets/header-logo.png')}
                            style={{ width: 120, height: 35 }}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
