import { Tabs } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { View, Platform } from "react-native";
import { useSession } from "../../lib/SessionContext";

export default function TabLayout() {
    const { unreadCount, markAsRead } = useSession();
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#121212",
                    borderTopWidth: 0,
                    borderTopColor: "#121212", // Match background to hide line
                    elevation: 0,
                    shadowOpacity: 0,
                    shadowOffset: { width: 0, height: 0 },
                    shadowRadius: 0,
                    shadowColor: "transparent",
                    overflow: 'hidden',
                    height: 90,
                    paddingBottom: 30,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: "#D4AF37", // Primary Gold
                tabBarInactiveTintColor: "#666",
                tabBarHideOnKeyboard: Platform.OS !== 'ios',
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
                name="chat"
                options={{
                    title: "Chat",
                    tabBarIcon: ({ color }) => <FontAwesome5 name="comments" size={20} color={color} />,
                    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: '#D4AF37',
                        color: '#000',
                        fontSize: 10,
                        fontWeight: 'bold',
                    }
                }}
                listeners={{
                    tabPress: () => {
                        console.log('[TabLayout] Chat tab pressed');
                        markAsRead();
                    },
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
