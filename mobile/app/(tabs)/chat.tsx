import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Keyboard, Alert, ScrollView, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { useSession } from "../../lib/SessionContext";
import { useNavigation } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";

export default function ChatScreen() {
    const { userId, getToken } = useAuth();
    const { user } = useUser();
    const { currentSession, unreadCount, lastReadAt, markAsRead } = useSession();
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const [messages, setMessages] = useState<any[]>([]);
    const [players, setPlayers] = useState<any[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [accessLoading, setAccessLoading] = useState(true);
    const [isTeamSession, setIsTeamSession] = useState(false);
    const [isTeamCaptain, setIsTeamCaptain] = useState(false);
    const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
    const [showTagging, setShowTagging] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);
    const pollingInterval = useRef<NodeJS.Timeout | null>(null);
    const isNearBottom = useRef(false);
    const initialScrollComplete = useRef(false);
    const pendingInitialScroll = useRef<{ type: 'index'; index: number } | { type: 'end' } | null>(null);
    const scrollDebounceTimer = useRef<NodeJS.Timeout | null>(null);
    const tabBarTimeout = useRef<NodeJS.Timeout | null>(null);
    const pendingFocus = useRef(false);

    // Use refs for stable access in intervals/callbacks without triggering re-renders
    const getTokenRef = useRef(getToken);
    const currentSessionRef = useRef(currentSession);
    const userIdRef = useRef(userId);

    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    useEffect(() => {
        currentSessionRef.current = currentSession;
        userIdRef.current = userId;
    }, [currentSession, userId]);

    useEffect(() => {
        const checkAccess = async () => {
            if (!currentSession?.id || !userId) {
                setIsTeamSession(false);
                setIsTeamCaptain(false);
                setAccessLoading(false);
                return;
            }

            setAccessLoading(true);

            try {
                const token = await getTokenRef.current({ template: 'supabase' });
                const authedSupabase = createClient(
                    process.env.EXPO_PUBLIC_SUPABASE_URL!,
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    { global: { headers: token ? { Authorization: `Bearer ${token}` } : undefined } }
                );

                const { data: leagueData } = await authedSupabase
                    .from('leagues')
                    .select('is_team_league')
                    .eq('id', currentSession.id)
                    .single();

                const teamSession = !!leagueData?.is_team_league;
                setIsTeamSession(teamSession);

                if (!teamSession) {
                    setIsTeamCaptain(false);
                    return;
                }

                const { data: captainTeam } = await authedSupabase
                    .from('teams')
                    .select('id')
                    .eq('league_id', currentSession.id)
                    .eq('captain_id', userId)
                    .maybeSingle();

                setIsTeamCaptain(!!captainTeam);
            } catch (e) {
                console.error("Error checking chat access:", e);
                setIsTeamSession(false);
                setIsTeamCaptain(false);
            } finally {
                setAccessLoading(false);
            }
        };

        checkAccess();
    }, [currentSession?.id, userId]);

    const fetchMessages = useCallback(async () => {
        const sessionId = currentSessionRef.current?.id;
        const uid = userIdRef.current;

        if (!sessionId || !uid || accessLoading || (isTeamSession && !isTeamCaptain)) {
            setLoading(false);
            return;
        }

        try {
            const token = await getTokenRef.current({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: token ? { Authorization: `Bearer ${token}` } : undefined } }
            );

            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    profiles:user_id(full_name, avatar_url, nickname, role, operator_status)
                `)
                .eq('league_id', sessionId)
                // Order by newest last for chat view
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data) {
                setMessages(data);
            }
        } catch (e: any) {
            // Suppress JWT expired errors
            if (e?.code === 'PGRST303' || e?.message?.includes('JWT expired')) {
                console.log("JWT expired, retrying next poll...");
                return;
            }
            console.error("Error fetching messages:", e);
        } finally {
            setLoading(false);
        }
    }, [getToken, accessLoading, isTeamSession, isTeamCaptain]);

    const fetchPlayers = useCallback(async () => {
        if (!currentSession?.id || accessLoading || (isTeamSession && !isTeamCaptain)) return;
        try {
            const token = await getTokenRef.current({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: token ? { Authorization: `Bearer ${token}` } : undefined } }
            );

            if (isTeamSession) {
                const { data, error } = await supabase
                    .from('teams')
                    .select(`
                        id,
                        name,
                        captain_id,
                        profiles:captain_id(id, full_name, avatar_url, nickname)
                    `)
                    .eq('league_id', currentSession.id);

                if (error) throw error;

                if (data) {
                    const mapped = data
                        .map((team: any) => {
                            const captain = Array.isArray(team.profiles) ? team.profiles[0] : team.profiles;
                            return captain ? {
                                ...captain,
                                team_name: team.name,
                                team_id: team.id,
                            } : null;
                        })
                        .filter(Boolean)
                        .filter((captain: any) => captain.id !== userId);

                    setPlayers(mapped);
                }

                return;
            }

            const { data, error } = await supabase
                .from('league_players')
                .select(`
                    player_id,
                    profiles:player_id(id, full_name, avatar_url, nickname)
                `)
                .eq('league_id', currentSession.id)
                .eq('status', 'active');

            if (error) throw error;
            if (data) {
                const mapped = data
                    .map((d: any) => d.profiles)
                    .filter(Boolean)
                    .filter((p: any) => p.id !== userId);
                setPlayers(mapped);
            }
        } catch (e) {
            console.error("Error fetching players for tagging:", e);
        }
    }, [getToken, currentSession?.id, userId, accessLoading, isTeamSession, isTeamCaptain]);

    useEffect(() => {
        fetchPlayers();
    }, [fetchPlayers]);

    const handleTagPlayer = (player: any) => {
        const name = player.nickname || player.full_name || 'Unknown';
        setInputText(prev => prev + `@[${name}] `);
        pendingFocus.current = true;
        setShowTagging(false);
    };

    // Focus input after tag modal closes (works on both iOS and Android)
    useEffect(() => {
        if (!showTagging && pendingFocus.current) {
            pendingFocus.current = false;
            const delay = Platform.OS === 'android' ? 400 : 100;
            setTimeout(() => inputRef.current?.focus(), delay);
        }
    }, [showTagging]);



    // Polling logic using navigation events
    useEffect(() => {
        const startPolling = () => {
            // Always clear any existing interval before starting a new one
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
                pollingInterval.current = null;
            }
            fetchMessages(); // Initial fetch
            pollingInterval.current = setInterval(fetchMessages, 10000);
        };

        const stopPolling = () => {
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
                pollingInterval.current = null;
            }
        };

        // Subscribe to focus/blur
        const unsubscribeFocus = navigation.addListener('focus', startPolling);
        const unsubscribeBlur = navigation.addListener('blur', stopPolling);

        // Manual check for initial focus
        startPolling();

        return () => {
            stopPolling();
            unsubscribeFocus();
            unsubscribeBlur();
        };
    }, []); // Empty dependency array = stable effect, only runs once on mount

    // Auto-scroll to bottom when keyboard opens
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                const delay = Platform.OS === 'android' ? 400 : 100;
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                }, delay);
            }
        );

        return () => {
            keyboardDidShowListener.remove();
        };
    }, []);

    // Save the initial lastReadAt before markAsRead overwrites it
    const initialLastReadAt = useRef<string | null>(null);
    const hasStoredInitialReadAt = useRef(false);

    useEffect(() => {
        if (lastReadAt && !hasStoredInitialReadAt.current) {
            initialLastReadAt.current = lastReadAt;
            hasStoredInitialReadAt.current = true;
        }
    }, [lastReadAt]);

    // Mark as read when focused or when new messages arrive while focused
    useEffect(() => {
        if (isFocused && currentSession?.id && unreadCount > 0) {
            markAsRead();
        }
    }, [isFocused, currentSession?.id, unreadCount, markAsRead]);

    // Handle initial scroll to oldest unread
    useEffect(() => {
        if (!loading && messages.length > 0 && !hasInitialScrolled) {
            const savedLastRead = initialLastReadAt.current;

            if (savedLastRead) {
                const oldestUnreadIndex = messages.findIndex(m =>
                    m.created_at > savedLastRead && m.user_id !== userId
                );

                if (oldestUnreadIndex !== -1) {
                    pendingInitialScroll.current = { type: 'index', index: oldestUnreadIndex };
                } else {
                    pendingInitialScroll.current = { type: 'end' };
                }
            } else {
                pendingInitialScroll.current = { type: 'end' };
            }

            // onContentSizeChange will pick this up, but we also set a timeout as backup
            // in case layout is already stable and onContentSizeChange doesn't fire again
            setTimeout(() => {
                executeInitialScroll();
            }, 500);

            setHasInitialScrolled(true);
        }
    }, [loading, messages.length, hasInitialScrolled, userId]);

    const executeInitialScroll = useCallback(() => {
        // Guard: only fire once
        if (initialScrollComplete.current) return;
        const pending = pendingInitialScroll.current;
        if (!pending) return;

        initialScrollComplete.current = true;
        pendingInitialScroll.current = null;

        if (pending.type === 'index') {
            try {
                flatListRef.current?.scrollToIndex({
                    index: pending.index,
                    animated: false,
                    viewPosition: 0
                });
            } catch (e) {
                flatListRef.current?.scrollToEnd({ animated: false });
            }
            isNearBottom.current = false;
        } else {
            flatListRef.current?.scrollToEnd({ animated: false });
            isNearBottom.current = true;
        }
    }, []);

    const handleDelete = async (message: any) => {
        Alert.alert(
            "Delete Message",
            "Are you sure you want to delete this message?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const previousMessages = [...messages];
                        // Optimistic update
                        setMessages(prev => prev.filter(m => m.id !== message.id));

                        try {
                            const token = await getToken({ template: 'supabase' });
                            const supabase = createClient(
                                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                                { global: { headers: token ? { Authorization: `Bearer ${token}` } : undefined } }
                            );

                            const { error } = await supabase
                                .from('messages')
                                .delete()
                                .eq('id', message.id);

                            if (error) throw error;
                        } catch (e) {
                            console.error("Error deleting message:", e);
                            alert("Failed to delete message.");
                            setMessages(previousMessages);
                        }
                    }
                }
            ]
        );
    };

    const handleSend = async () => {
        if (isTeamSession && !isTeamCaptain) return;
        if (!inputText.trim() || !currentSession?.id || !userId) return;

        const content = inputText.trim();
        setInputText("");
        setSending(true);

        const tempId = Date.now().toString();
        const optimisticMessage = {
            id: tempId,
            league_id: currentSession.id,
            user_id: userId,
            content: content,
            created_at: new Date().toISOString(),
            profiles: {
                full_name: user?.fullName || "Me",
                avatar_url: user?.imageUrl, // Access clerk image url
                nickname: null,
                role: 'player', // Default
                operator_status: null
            },
            isOptimistic: true // UI helper
        };

        // Add optimistic
        setMessages(prev => [...prev, optimisticMessage]);

        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const token = await getTokenRef.current({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: token ? { Authorization: `Bearer ${token}` } : undefined } }
            );

            // Insert
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    league_id: currentSession.id,
                    user_id: userId,
                    content: content
                })
                .select(`
                    *,
                    profiles:user_id(full_name, avatar_url, nickname, role, operator_status)
                `)
                .single();

            if (error) throw error;

            // Replace optimistic
            setMessages(prev => prev.map(m => m.id === tempId ? data : m));

            // Fire-and-forget: send push notification for @mentions
            const mentionMatches = content.match(/@\[[^\]]+\]/g);
            if (mentionMatches && mentionMatches.length > 0) {
                const taggedNames = mentionMatches.map((m: string) => m.slice(2, -1));
                const taggedPlayerIds = players
                    .filter((p: any) => {
                        const name = (p.nickname || p.full_name || '').toLowerCase();
                        return taggedNames.some((t: string) => t.toLowerCase() === name);
                    })
                    .map((p: any) => p.id);

                if (taggedPlayerIds.length > 0) {
                    supabase.functions.invoke('send-mention-notification', {
                        body: {
                            taggedPlayerIds,
                            senderName: user?.fullName || 'Someone',
                            sessionName: currentSession?.parentLeagueName
                                ? `${currentSession.parentLeagueName} - ${currentSession.name}`
                                : currentSession?.name || 'Session'
                        }
                    }).catch((e: any) => console.error('Mention notification error:', e));
                }
            }

        } catch (e) {
            console.error("Error sending message:", e);
            // Revert on failure
            setMessages(prev => prev.filter(m => m.id !== tempId));
            alert("Failed to send message.");
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item, index }: { item: any, index: number }) => {
        const isMe = item.user_id === userId;
        const profile = item.profiles;

        let displayName = profile?.full_name || 'Unknown';
        if (profile?.role === 'operator' || profile?.role === 'admin' || profile?.operator_status === 'active') {
            displayName += ' - L.O.';
        }

        const avatar = profile?.avatar_url;
        const date = new Date(item.created_at);
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let showDateSeparator = false;
        let dateLabel = "";

        if (index === 0) {
            showDateSeparator = true;
        } else {
            const prevItem = messages[index - 1];
            const prevDate = new Date(prevItem.created_at);
            if (date.toDateString() !== prevDate.toDateString()) {
                showDateSeparator = true;
            }
        }

        if (showDateSeparator) {
            const now = new Date();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (date.toDateString() === now.toDateString()) {
                dateLabel = "Today";
            } else if (date.toDateString() === yesterday.toDateString()) {
                dateLabel = "Yesterday";
            } else {
                dateLabel = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            }
        }

        return (
            <View>
                {showDateSeparator && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12 }}>
                        <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                        <Text style={{ marginHorizontal: 12, color: '#999', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {dateLabel}
                        </Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    </View>
                )}

                <View style={{ flexDirection: 'row', marginBottom: 16, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && (
                        <View style={{ marginRight: 8, justifyContent: 'flex-end' }}>
                            {avatar ? (
                                <Image source={{ uri: avatar }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#333' }} />
                            ) : (
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }}>
                                    <FontAwesome5 name="user" size={14} color="#ccc" />
                                </View>
                            )}
                        </View>
                    )}

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onLongPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                            handleDelete(item);
                        }}
                        style={{
                            maxWidth: '75%',
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 16,
                            backgroundColor: isMe ? '#D4AF37' : '#1e1e1e',
                            borderTopRightRadius: isMe ? 0 : 16,
                            borderTopLeftRadius: !isMe ? 0 : 16,
                            borderWidth: isMe ? 0 : 1,
                            borderColor: '#333'
                        }}
                    >
                        {!isMe && (
                            <View style={{
                                alignSelf: 'flex-start',
                                backgroundColor: 'rgba(212, 175, 55, 0.15)',
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 6,
                                marginBottom: 4,
                                borderWidth: 1,
                                borderColor: 'rgba(212, 175, 55, 0.3)'
                            }}>
                                <Text style={{
                                    color: '#D4AF37',
                                    fontSize: 10,
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5
                                }}>
                                    {displayName}
                                </Text>
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                            {item.content.split(/(@\[[^\]]+\])/).map((part: string, i: number) =>
                                part.startsWith('@[') && part.endsWith(']') ? (
                                    <View key={i} style={{
                                        backgroundColor: isMe ? 'rgba(0,0,0,0.15)' : 'rgba(212, 175, 55, 0.15)',
                                        paddingHorizontal: 8,
                                        paddingVertical: 2,
                                        borderRadius: 6,
                                        borderWidth: 1,
                                        borderColor: isMe ? 'rgba(0,0,0,0.3)' : 'rgba(212, 175, 55, 0.3)',
                                        marginVertical: 2,
                                    }}>
                                        <Text style={{
                                            color: isMe ? '#000' : '#D4AF37',
                                            fontSize: 13,
                                            fontWeight: 'bold',
                                        }}>@{part.slice(2, -1)}</Text>
                                    </View>
                                ) : (
                                    <Text key={i} style={{ fontSize: 15, color: isMe ? '#000' : '#fff' }}>{part}</Text>
                                )
                            )}
                        </View>

                        <Text style={{ fontSize: 10, marginTop: 4, textAlign: 'right', color: isMe ? 'rgba(0,0,0,0.5)' : '#666' }}>
                            {time}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['left', 'right']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 110}
            >
                <View style={{ padding: 16, paddingBottom: 16, backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}>
                    <Text style={{ color: '#999', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                        Session Forum
                    </Text>
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center' }} numberOfLines={1}>
                        {currentSession?.name || 'Chat'}
                    </Text>
                </View>

                {loading || accessLoading ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color="#D4AF37" />
                    </View>
                ) : isTeamSession && !isTeamCaptain ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                        <FontAwesome5 name="crown" size={40} color="#D4AF37" />
                        <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 18, textAlign: 'center' }}>
                            Captains Only
                        </Text>
                        <Text style={{ color: '#888', fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 20 }}>
                            Team session chat is only available to team captains.
                        </Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        <FlatList
                            ref={flatListRef}
                            style={{ flex: 1 }}
                            data={messages}
                            keyExtractor={(item) => item.id}
                            renderItem={renderMessage}
                            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 60 }}
                            initialNumToRender={messages.length}
                            maxToRenderPerBatch={messages.length}

                            onContentSizeChange={() => {
                                // If there's a pending initial scroll, debounce until content size stabilizes
                                if (pendingInitialScroll.current && !initialScrollComplete.current) {
                                    // Clear any previous timer
                                    if (scrollDebounceTimer.current) {
                                        clearTimeout(scrollDebounceTimer.current);
                                    }
                                    // Wait for content size to stop changing before scrolling
                                    const delay = Platform.OS === 'android' ? 300 : 150;
                                    scrollDebounceTimer.current = setTimeout(() => {
                                        executeInitialScroll();
                                        scrollDebounceTimer.current = null;
                                    }, delay);
                                    return;
                                }
                                // Only auto-scroll if initial scroll is done and user is near the bottom
                                if (initialScrollComplete.current && isNearBottom.current) {
                                    flatListRef.current?.scrollToEnd({ animated: false });
                                }
                            }}
                            onScroll={(e) => {
                                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                                const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
                                isNearBottom.current = distanceFromBottom < 150;
                            }}
                            scrollEventThrottle={200}
                            onScrollToIndexFailed={(info) => {
                                flatListRef.current?.scrollToOffset({
                                    offset: info.averageItemLength * info.index,
                                    animated: true
                                });
                            }}

                            keyboardDismissMode="on-drag"
                            keyboardShouldPersistTaps="handled"
                            ListEmptyComponent={
                                <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 80, opacity: 0.5 }}>
                                    <FontAwesome5 name="comments" size={48} color="#666" />
                                    <Text style={{ color: '#666', marginTop: 16, textAlign: 'center' }}>
                                        No messages yet.{'\n'}Start the conversation!
                                    </Text>
                                </View>
                            }
                        />

                        <View style={{ padding: 16, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => setShowTagging(true)}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#1e1e1e',
                                    borderWidth: 1,
                                    borderColor: '#333'
                                }}
                            >
                                <FontAwesome5 name="user-plus" size={14} color="#D4AF37" />
                            </TouchableOpacity>
                            <TextInput
                                ref={inputRef}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Type a message..."
                                placeholderTextColor="#666"
                                style={{
                                    flex: 1,
                                    backgroundColor: '#1e1e1e',
                                    borderColor: '#333',
                                    borderWidth: 1,
                                    borderRadius: 24,
                                    paddingHorizontal: 16,
                                    paddingVertical: 12,
                                    color: '#fff',
                                    maxHeight: 100
                                }}
                                multiline
                            />
                            <TouchableOpacity
                                onPress={handleSend}
                                disabled={!inputText.trim() || sending}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 24,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: inputText.trim() ? '#D4AF37' : '#333'
                                }}
                            >
                                {sending ? (
                                    <ActivityIndicator color="black" size="small" />
                                ) : (
                                    <Ionicons name="send" size={20} color={inputText.trim() ? "black" : "#aaa"} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </KeyboardAvoidingView>

            {/* Player Tag Picker Modal */}
            <Modal
                visible={showTagging}
                transparent
                animationType="slide"
                onRequestClose={() => setShowTagging(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowTagging(false)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
                >
                    <TouchableOpacity activeOpacity={1} onPress={() => { }}>
                        <View style={{
                            backgroundColor: '#1a1a1a',
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            paddingTop: 16,
                            paddingBottom: 40,
                            maxHeight: 400
                        }}>
                            <View style={{ alignItems: 'center', marginBottom: 12 }}>
                                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#444' }} />
                            </View>
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                                {isTeamSession ? 'Tag a Team Captain' : 'Tag a Player'}
                            </Text>
                            {players.length === 0 ? (
                                <Text style={{ color: '#666', textAlign: 'center', paddingVertical: 20 }}>
                                    {isTeamSession ? 'No other team captains in this session.' : 'No other players in this session.'}
                                </Text>
                            ) : (
                                <ScrollView style={{ paddingHorizontal: 16 }}>
                                    {players.map((player: any) => (
                                        <TouchableOpacity
                                            key={player.id}
                                            onPress={() => handleTagPlayer(player)}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                paddingVertical: 12,
                                                paddingHorizontal: 12,
                                                borderBottomWidth: 1,
                                                borderBottomColor: 'rgba(255,255,255,0.05)'
                                            }}
                                        >
                                            {player.avatar_url ? (
                                                <Image source={{ uri: player.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', marginRight: 12 }} />
                                            ) : (
                                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                                    <FontAwesome5 name="user" size={14} color="#ccc" />
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                                                    {isTeamSession ? (player.team_name || 'Unknown Team') : (player.nickname || player.full_name || 'Unknown')}
                                                </Text>
                                                {isTeamSession && (
                                                    <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                                                        {player.nickname || player.full_name || 'Unknown'}
                                                    </Text>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView >
    );
}
