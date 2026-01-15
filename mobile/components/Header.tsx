import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, ActivityIndicator, Platform, StatusBar, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    const isMounted = useRef(true);

    const [nickname, setNickname] = useState<string>('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [rating, setRating] = useState<{ level: string, confidence: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [retried, setRetried] = useState(false);

    useEffect(() => {
        isMounted.current = true;
        const fetchProfile = async () => {
            if (!userId) return;
            try {
                const token = await getToken({ template: 'supabase' });

                if (!isMounted.current) return;

                const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;
                const supabase = createClient(supabaseUrl, supabaseAnonKey, {
                    global: { headers: authHeader },
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                });

                const { data, error } = await supabase
                    .from('profiles')
                    .select('nickname, full_name, fargo_rating, breakpoint_rating, avatar_url')
                    .eq('id', userId)
                    .single();

                if (!isMounted.current) return;

                if (error) {
                    // console.warn("[Header] Supabase Query Error:", error.message);
                }

                if (data) {
                    const displayName = data.nickname || (data.full_name ? data.full_name.split(' ')[0] : 'User') || 'User';

                    // Simple Retry Logic
                    if ((displayName === 'User' || displayName === 'Player') && !retried) {
                        setRetried(true);
                        setTimeout(() => {
                            if (isMounted.current) fetchProfile();
                        }, 1000);
                        return;
                    }

                    const { data: leagueStats } = await supabase
                        .from('league_players')
                        .select('breakpoint_racks_played')
                        .eq('player_id', userId);

                    if (!isMounted.current) return;

                    const confidence = leagueStats
                        ? leagueStats.reduce((sum, item) => sum + (item.breakpoint_racks_played || 0), 0)
                        : 0;

                    const displayRating = data.breakpoint_rating || data.fargo_rating || 500;
                    const formattedRating = getBreakpointLevel(displayRating);

                    setNickname(displayName);
                    setAvatarUrl(data.avatar_url);
                    setRating({ level: formattedRating, confidence });
                } else {
                    setNickname("User");
                }
            } catch (error) {
                console.warn("Error fetching header profile:", error);
                if (isMounted.current) setNickname("User");
            } finally {
                if (isMounted.current) setLoading(false);
            }
        };

        fetchProfile();

        const subscription = DeviceEventEmitter.addListener('refreshProfile', fetchProfile);

        return () => {
            isMounted.current = false;
            subscription.remove();
        };
    }, [userId]);

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="bg-surface pb-4">
            <View className="flex-row items-center justify-between px-4 pt-2 h-16">
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

                            <View className="flex-1">
                                <Text className="text-white font-bold text-xl mb-1" numberOfLines={1} adjustsFontSizeToFit style={{ includeFontPadding: false }}>
                                    Hello, <Text className="text-primary">{nickname}</Text>
                                </Text>
                                <View className="flex-row items-center pr-2">
                                    <Text className="text-gray-400 text-sm font-bold tracking-wider shrink-0" style={{ includeFontPadding: false }}>BP: </Text>
                                    <View className="mx-1 justify-center min-w-[30px]">
                                        <Text className="text-primary text-base font-bold" style={{ includeFontPadding: false }}>{rating?.level || '-'}</Text>
                                    </View>
                                    <View className="justify-center">
                                        <Text className="text-gray-300 text-xs font-bold shrink-0" style={{ includeFontPadding: false }}>({rating?.confidence || 0}) </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* Right: Logo */}
                <View>
                    <View>
                        <Image
                            source={require('../assets/header-logo.png')}
                            style={{ width: 120, height: 35 }}
                            resizeMode="contain"
                        />
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
