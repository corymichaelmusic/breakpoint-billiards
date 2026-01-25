import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { getBreakpointLevel } from "../../utils/rating";

export default function PlayerLookupScreen() {
    const { getToken } = useAuth();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [players, setPlayers] = useState<any[]>([]);

    const handleSearch = async (text: string) => {
        setSearchQuery(text);
        if (text.length < 2) {
            setPlayers([]);
            return;
        }

        setLoading(true);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: token ? { Authorization: `Bearer ${token}` } : undefined } }
            );

            // Search by full_name or player_number
            let query = supabase
                .from('profiles')
                .select('id, full_name, player_number, breakpoint_rating, nickname')
                .or(`full_name.ilike.%${text}%,nickname.ilike.%${text}%`);

            // If text is numeric, also search by player_number
            if (!isNaN(Number(text))) {
                query = supabase
                    .from('profiles')
                    .select('id, full_name, player_number, breakpoint_rating, nickname')
                    .or(`full_name.ilike.%${text}%,nickname.ilike.%${text}%,player_number.eq.${text}`);
            }

            const { data, error } = await query.limit(20);

            if (error) throw error;
            setPlayers(data || []);
        } catch (e) {
            console.error("Error searching players:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* Header */}
            <View className="px-4 py-4 bg-background border-b border-white/5 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2">
                    <FontAwesome5 name="arrow-left" size={20} color="#D4AF37" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-white uppercase tracking-wide" style={{ includeFontPadding: false }}>
                    Player Lookup
                </Text>
            </View>

            {/* Search Input */}
            <View className="p-4">
                <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-2">
                    <Ionicons name="search" size={20} color="#666" />
                    <TextInput
                        className="flex-1 h-10 text-white ml-2 text-base"
                        placeholder="Search by name or ID..."
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={handleSearch}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch("")}>
                            <Ionicons name="close-circle" size={20} color="#666" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Results */}
            <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
                {loading ? (
                    <View className="py-10">
                        <ActivityIndicator color="#D4AF37" size="large" />
                    </View>
                ) : players.length > 0 ? (
                    players.map((player) => (
                        <TouchableOpacity
                            key={player.id}
                            onPress={() => router.push(`/player/${player.id}`)}
                            className="bg-surface border border-border rounded-xl p-4 mb-3 flex-row items-center justify-between"
                        >
                            <View className="flex-1">
                                <Text className="text-white font-bold text-lg" style={{ includeFontPadding: false }}>
                                    {player.full_name}
                                    {player.nickname ? ` (${player.nickname})` : ''}
                                </Text>
                                <Text className="text-gray-400 text-xs uppercase tracking-widest mt-1">
                                    ID: #{player.player_number || '---'}
                                </Text>
                            </View>
                            <View className="bg-primary/20 px-3 py-1 rounded">
                                <Text className="text-primary font-bold">
                                    {getBreakpointLevel(player.breakpoint_rating || 500)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))
                ) : searchQuery.length >= 2 ? (
                    <Text className="text-gray-500 text-center py-10">No players found.</Text>
                ) : (
                    <View className="py-10 items-center opacity-30">
                        <Ionicons name="search-outline" size={64} color="#666" />
                        <Text className="text-gray-500 text-center mt-4">Enter at least 2 characters to search.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
