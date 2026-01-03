import { View, Text, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function PaymentSuccess() {
    const router = useRouter();
    const { match_id } = useLocalSearchParams();

    return (
        <View className="flex-1 bg-background justify-center items-center p-6">
            <View className="bg-surface/50 p-8 rounded-2xl items-center border border-border w-full max-w-sm">
                <View className="w-20 h-20 bg-green-500/20 rounded-full items-center justify-center mb-6 border border-green-500/50">
                    <Ionicons name="checkmark" size={40} color="#4ade80" />
                </View>

                <Text className="text-white text-2xl font-bold mb-2 text-center">Payment Successful</Text>
                <Text className="text-gray-400 text-center mb-8">
                    Your match fee has been processed. You are now ready to play!
                </Text>

                <TouchableOpacity
                    onPress={() => {
                        if (match_id) {
                            router.replace(`/match/${match_id}`);
                        } else {
                            router.replace("/(tabs)");
                        }
                    }}
                    className="bg-primary w-full py-4 rounded-xl active:opacity-90"
                >
                    <Text className="text-black font-bold text-center text-lg uppercase tracking-wider">
                        Return to Action
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
