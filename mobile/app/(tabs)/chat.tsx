import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Keyboard, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { useSession } from "../../lib/SessionContext";
import { useNavigation } from "expo-router";
import { useIsFocused } from "@react-navigation/native";

export default function ChatScreen() {
    const { userId, getToken } = useAuth();
    const { user } = useUser();
    const { currentSession, unreadCount, lastReadAt, markAsRead } = useSession();
    const isFocused = useIsFocused();
    const [messages, setMessages] = useState<any[]>([]);
    const [players, setPlayers] = useState<any[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Use refs for stable access in intervals/callbacks without triggering re-renders
    const currentSessionRef = useRef(currentSession);
    const userIdRef = useRef(userId);

    useEffect(() => {
        currentSessionRef.current = currentSession;
        userIdRef.current = userId;
    }, [currentSession, userId]);

    const fetchMessages = useCallback(async () => {
        const sessionId = currentSessionRef.current?.id;
        const uid = userIdRef.current;

        if (!sessionId || !uid) {
            setLoading(false);
            return;
        }

        try {
            const token = await getToken({ template: 'supabase' });
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
    }, [getToken]);

    const navigation = useNavigation();

    // Polling logic using navigation events
    useEffect(() => {
        let interval: NodeJS.Timeout;

        const startPolling = () => {
            console.log("Chat focused, starting poll");
            fetchMessages(); // Initial fetch
            interval = setInterval(fetchMessages, 10000);
        };

        const stopPolling = () => {
            console.log("Chat blurred, stopping poll");
            if (interval) clearInterval(interval);
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

    // Auto-scroll to bottom when keyboard opens (iOS only)
    // Android handled by adjustResize and FlatList's onContentSizeChange
    useEffect(() => {
        if (Platform.OS !== 'ios') return;

        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }
        );

        return () => {
            keyboardDidShowListener.remove();
        };
    }, []);

    // Mark as read when focused or when new messages arrive while focused
    useEffect(() => {
        if (isFocused && currentSession?.id && unreadCount > 0) {
            markAsRead();
        }
    }, [isFocused, currentSession?.id, unreadCount, markAsRead]);

    // Handle initial scroll to oldest unread
    useEffect(() => {
        if (!loading && messages.length > 0 && !hasInitialScrolled && lastReadAt) {
            const oldestUnreadIndex = messages.findIndex(m =>
                m.created_at > lastReadAt && m.user_id !== userId
            );

            if (oldestUnreadIndex !== -1) {
                // Scroll to the oldest unread message
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({
                        index: oldestUnreadIndex,
                        animated: true,
                        viewPosition: 0 // Top of the list
                    });
                }, 500);
            } else {
                // Just scroll to bottom
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                }, 100);
            }
            setHasInitialScrolled(true);
        }
    }, [loading, messages.length, hasInitialScrolled, lastReadAt, userId]);

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
            const token = await getToken({ template: 'supabase' });
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

                        <Text style={{ fontSize: 15, color: isMe ? '#000' : '#fff', opacity: isMe ? 0.9 : 1 }}>
                            {item.content}
                        </Text>

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
            <View style={{ padding: 16, paddingBottom: 16, backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}>
                <Text style={{ color: '#999', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                    Session Forum
                </Text>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center' }} numberOfLines={1}>
                    {currentSession?.name || 'Chat'}
                </Text>
            </View>

            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#D4AF37" />
                </View>
            ) : (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 115 : 0}
                >
                    <FlatList
                        ref={flatListRef}
                        style={{ flex: 1 }}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 }}
                        onContentSizeChange={() => {
                            if (hasInitialScrolled) {
                                flatListRef.current?.scrollToEnd({ animated: false });
                            }
                        }}
                        onScrollToIndexFailed={(info) => {
                            flatListRef.current?.scrollToOffset({
                                offset: info.averageItemLength * info.index,
                                animated: true
                            });
                        }}
                        getItemLayout={(data, index) => (
                            { length: 120, offset: 120 * index, index } // Approximate height
                        )}
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

                    <View style={{ padding: 16, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TextInput
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
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}
