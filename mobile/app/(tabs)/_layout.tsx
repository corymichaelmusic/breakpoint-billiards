import { Tabs } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { View } from "react-native";

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#121212", // Surface color matching theme
                    borderTopColor: "#333",
                    height: 90,
                    paddingBottom: 30,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: "#D4AF37", // Primary Gold
                tabBarInactiveTintColor: "#666",
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Dashboard",
                    tabBarIcon: ({ color }) => <FontAwesome5 name="home" size={20} color={color} />,
                }}
            />
            <Tabs.Screen
                name="leaderboard"
                options={{
                    title: "Leaderboard",
                    tabBarIcon: ({ color }) => <FontAwesome5 name="trophy" size={20} color={color} />,
                }}
            />
            <Tabs.Screen
                name="stats"
                options={{
                    title: "Stats",
                    tabBarIcon: ({ color }) => <FontAwesome5 name="chart-bar" size={20} color={color} />,
                }}
            />
            <Tabs.Screen
                name="matches"
                options={{
                    title: "Matches",
                    tabBarIcon: ({ color }) => <FontAwesome5 name="list" size={20} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color }) => <FontAwesome5 name="user" size={20} color={color} />,
                }}
            />
        </Tabs>
    );
}
