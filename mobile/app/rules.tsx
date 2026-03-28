import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BIS_SECTIONS } from '../constants/RulesText';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function RulesScreen() {
    const router = useRouter();
    const { userId, getToken } = useAuth();
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }
            try {
                const token = await getToken({ template: 'supabase' });
                if (!token) return;
                const supabase = createClient(
                    process.env.EXPO_PUBLIC_SUPABASE_URL!,
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    { global: { headers: { Authorization: `Bearer ${token}` } } }
                );
                const { data } = await supabase
                    .from('profiles')
                    .select('bis_rules_agreed')
                    .eq('id', userId)
                    .single();
                if (data?.bis_rules_agreed) {
                    setAgreed(true);
                }
            } catch (err) {
                console.error("Error fetching rules status", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStatus();
    }, [userId]);

    const handleAgree = async () => {
        if (!userId) return;
        setSubmitting(true);
        try {
            const token = await getToken({ template: 'supabase' });
            if (!token) throw new Error("No token");
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );
            const { error } = await supabase
                .from('profiles')
                .update({ bis_rules_agreed: true })
                .eq('id', userId);

            if (error) throw error;

            setAgreed(true);
            Alert.alert("Success", "You have successfully acknowledged the International Standard Rules.");
        } catch (err: any) {
            console.error("Error agreeing to rules", err);
            Alert.alert("Error", "There was an issue saving your signature. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* Header */}
            <View className="flex-row items-center p-4 border-b border-white/10">
                <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
                    <Ionicons name="arrow-back" size={24} color="#D4AF37" />
                </TouchableOpacity>
                <Text className="text-white text-xl font-bold uppercase tracking-wider" style={{ includeFontPadding: false }}>
                    Official Rules
                </Text>
            </View>

            {/* Content */}
            <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
                <View className="items-center mb-8">
                    <Ionicons name="book" size={48} color="#D4AF37" />
                    <Text className="text-primary text-2xl font-bold mt-4 text-center">BREAKPOINT BILLIARDS</Text>
                    <Text className="text-gray-400 text-sm tracking-widest uppercase mt-1 text-center">International Standard</Text>
                </View>

                {BIS_SECTIONS.map((section, index) => (
                    <View key={index} className="mb-8">
                        {section.header !== 'Introduction' && (
                            <Text className="text-primary text-lg font-bold mb-3 uppercase tracking-wider">
                                {section.header}
                            </Text>
                        )}
                        {section.body && section.body.text && (
                            <Text className="text-gray-300 text-base leading-7">
                                {section.body.text}
                            </Text>
                        )}
                        {section.body && section.body.bullets && section.body.bullets.map((bullet: string, bIndex: number) => (
                            <View key={bIndex} className="flex-row mt-2 pl-2">
                                <Text className="text-gray-300 text-base leading-7 flex-1">
                                    {bullet}
                                </Text>
                            </View>
                        ))}
                    </View>
                ))}

                {/* Agreement Section */}
                {!loading && (
                    <View className="mt-8 mb-16 pt-8 border-t border-white/10 items-center">
                        {agreed ? (
                            <View className="bg-green-900/30 border border-green-500/50 p-4 rounded-xl items-center w-full flex-row justify-center gap-3">
                                <Ionicons name="checkmark-circle" size={24} color="#4ade80" />
                                <Text className="text-green-400 font-bold text-base tracking-wider uppercase">Signed and Acknowledged</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={handleAgree}
                                disabled={submitting}
                                className="bg-primary px-8 py-4 rounded-xl shadow-lg shadow-black/50 items-center w-full flex-row justify-center gap-3 active:bg-primary/80"
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <>
                                        <Ionicons name="create-outline" size={24} color="#000" />
                                        <Text className="text-black font-bold text-base tracking-widest uppercase">Sign & Acknowledge</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                        <Text className="text-gray-500 text-xs text-center mt-4 px-4 leading-5">By acknowledging, you confirm that you have read, understood, and agree to abide by the Breakpoint International Standard Rules.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
