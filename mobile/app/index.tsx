import { View, ActivityIndicator } from "react-native";

export default function Index() {
    // Passive Root: Just waits for _layout.tsx to redirect.
    // This prevents expo-router from crashing on missing root route.
    return (
        <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#D4AF37" />
        </View>
    );
}
