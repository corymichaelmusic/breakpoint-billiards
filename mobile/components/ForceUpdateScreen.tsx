
import React from 'react';
import { View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ForceUpdateScreenProps {
    storeUrl: string;
}

export default function ForceUpdateScreen({ storeUrl }: ForceUpdateScreenProps) {
    const handleUpdatePress = () => {
        Linking.openURL(storeUrl).catch((err) =>
            console.error('An error occurred', err)
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
            <View className="items-center space-y-6">
                <View className="w-24 h-24 bg-primary/20 rounded-full items-center justify-center mb-4">
                    <MaterialCommunityIcons name="update" size={48} color="#D4AF37" />
                </View>

                <Text className="text-2xl font-bold text-white text-center">
                    Update Required
                </Text>

                <Text className="text-gray-400 text-center text-lg mb-8">
                    A new version of Breakpoint Billiards is available. Please update to continue using the app.
                </Text>

                <TouchableOpacity
                    onPress={handleUpdatePress}
                    className="bg-primary w-full py-4 rounded-xl active:opacity-90"
                >
                    <Text className="text-black font-bold text-center text-lg">
                        Update Now
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
