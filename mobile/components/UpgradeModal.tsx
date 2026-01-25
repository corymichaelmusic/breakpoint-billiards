import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";

interface UpgradeModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function UpgradeModal({ visible, onClose }: UpgradeModalProps) {
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleUpgrade = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const apiUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://breakpointbilliardsleague.com';

            const response = await fetch(`${apiUrl}/api/create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type: 'pro_subscription',
                    source: 'mobile'
                })
            });

            const data = await response.json();
            if (data.url) {
                Linking.openURL(data.url);
                onClose();
                Alert.alert("Complete Payment", "After completing payment in your browser, your Pro features will be unlocked immediately.");
            } else {
                Alert.alert("Error", data.error || "Failed to create checkout session.");
            }
        } catch (e) {
            console.error("Upgrade Error:", e);
            Alert.alert("Error", "Could not start upgrade process. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/80 justify-end">
                <View className="bg-surface rounded-t-3xl p-6 h-[80%] border-t border-border">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-white text-2xl font-bold uppercase tracking-wider">Upgrade to Pro</Text>
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <Ionicons name="close" size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View className="mb-8 items-center">
                            <View className="w-20 h-20 bg-primary/20 rounded-full items-center justify-center mb-4 border border-primary/50">
                                <Ionicons name="star" size={40} color="#D4AF37" />
                            </View>
                            <Text className="text-gray-300 text-center mb-6 text-base px-4">
                                Unlock advanced analytics, detailed opponent stats, and history for all your matches.
                            </Text>

                            <View className="w-full gap-4 px-2">
                                <FeatureItem icon="analytics-outline" text="Complete stats breakdown for any player" />
                                <FeatureItem icon="people-outline" text="Advanced Opponent Research" />
                                <FeatureItem icon="time-outline" text="Complete Match history for any player" />
                                <FeatureItem icon="ribbon-outline" text="Pro badge on leaderboards" />
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleUpgrade}
                            disabled={loading}
                            className="bg-primary py-4 rounded-xl items-center shadow-lg active:opacity-90"
                        >
                            {loading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text className="text-black font-bold text-lg uppercase tracking-widest">Upgrade Now</Text>
                            )}
                        </TouchableOpacity>

                        <Text className="text-[10px] text-gray-500 text-center mt-6">
                            Subscriptions are managed via Stripe. You can cancel at any time.
                        </Text>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function FeatureItem({ icon, text }: { icon: any, text: string }) {
    return (
        <View className="flex-row items-center gap-3 mb-3 bg-white/5 p-3 rounded-lg border border-white/5">
            <Ionicons name={icon} size={20} color="#4ade80" />
            <Text className="text-gray-200 font-medium">{text}</Text>
        </View>
    );
}
