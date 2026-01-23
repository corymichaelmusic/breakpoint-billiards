import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Image, ActivityIndicator, Platform, StatusBar, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useFocusEffect } from 'expo-router';
import { getBreakpointLevel } from '../utils/rating';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../lib/SessionContext';
import SessionSwitcherModal from './SessionSwitcherModal';

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
    const lastFetch = useRef(0);
    const [showSessionSwitcher, setShowSessionSwitcher] = useState(false);

    // Session context
    const { currentSession, sessions } = useSession();

    const fetchProfile = useCallback(async (force = false) => {
        if (!userId) return;

        const now = Date.now();
        // Throttle: Skip if less than 5 seconds since last fetch, unless forced
        if (!force && now - lastFetch.current < 5000) {
            return;
        }
        lastFetch.current = now;

        try {
            const token = await getToken({ template: 'supabase' });

            if (!isMounted.current) return;

            const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;
            const supabase = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: authHeader }
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
                        if (isMounted.current) fetchProfile(true);
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
    }, [userId, getToken, retried]);

    // Initial mount effect and DeviceEventEmitter subscription
    useEffect(() => {
        isMounted.current = true;
        fetchProfile();

        const subscription = DeviceEventEmitter.addListener('refreshProfile', () => fetchProfile(true));

        return () => {
            isMounted.current = false;
            subscription.remove();
        };
    }, [fetchProfile]);

    // Refresh on screen focus (fixes Android not updating after navigation)
    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [fetchProfile])
    );

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="bg-surface pb-2">
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
                                        <Text className="text-gray-300 text-base font-bold shrink-0" style={{ includeFontPadding: false }}>({rating?.confidence || 0}) </Text>
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

            {/* Session Indicator */}
            {currentSession && sessions.length > 0 && (
                <TouchableOpacity
                    onPress={() => setShowSessionSwitcher(true)}
                    className="flex-row items-center justify-center px-4 py-1 mt-1"
                    activeOpacity={0.7}
                >
                    <View className="bg-background/50 border border-border/50 rounded-full px-3 py-1 flex-row items-center">
                        {currentSession.isPrimary && (
                            <Ionicons name="star" size={12} color="#D4AF37" style={{ marginRight: 4 }} />
                        )}
                        <Text className="text-gray-300 text-xs font-medium" numberOfLines={1} style={{ includeFontPadding: false }}>
                            {currentSession.name}
                        </Text>
                        {sessions.length > 1 && (
                            <Ionicons name="chevron-down" size={14} color="#9CA3AF" style={{ marginLeft: 4 }} />
                        )}
                    </View>
                </TouchableOpacity>
            )}

            {/* Session Switcher Modal */}
            <SessionSwitcherModal
                visible={showSessionSwitcher}
                onClose={() => setShowSessionSwitcher(false)}
            />
        </SafeAreaView>
    );
}
