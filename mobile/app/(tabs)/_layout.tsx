import { Tabs } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSession } from "../../lib/SessionContext";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/clerk-expo";

export default function TabLayout() {
    const { unreadCount, markAsRead, currentSession } = useSession();
    const { getToken, userId } = useAuth();
    const [isTeamSession, setIsTeamSession] = useState(false);
    const [isTeamCaptain, setIsTeamCaptain] = useState(false);
    const getTokenRef = useRef(getToken);

    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    useEffect(() => {
        if (!currentSession?.id || !userId) {
            setIsTeamSession(false);
            setIsTeamCaptain(false);
            return;
        }

        const check = async () => {
            try {
                const token = await getTokenRef.current({ template: 'supabase' });
                const supabase = createClient(
                    process.env.EXPO_PUBLIC_SUPABASE_URL!,
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    { global: { headers: { Authorization: `Bearer ${token}` } } }
                );
                const { data } = await supabase.from('leagues').select('is_team_league').eq('id', currentSession.id).single();
                const teamSession = !!data?.is_team_league;
                setIsTeamSession(teamSession);

                if (!teamSession) {
                    setIsTeamCaptain(false);
                    return;
                }

                const { data: captainTeam } = await supabase
                    .from('teams')
                    .select('id')
                    .eq('league_id', currentSession.id)
                    .eq('captain_id', userId)
                    .maybeSingle();

                setIsTeamCaptain(!!captainTeam);
            } catch {
                setIsTeamSession(false);
                setIsTeamCaptain(false);
            }
        };
        check();
    }, [currentSession?.id, userId]);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#121212",
                    borderTopWidth: 0,
                    borderTopColor: "#121212",
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
                tabBarActiveTintColor: "#D4AF37",
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
                name="teams"
                options={{
                    title: "Teams",
                    tabBarIcon: ({ color }) => (
                        <FontAwesome5
                            name="users"
                            size={20}
                            color={isTeamSession ? color : '#333'}
                        />
                    ),
                    tabBarActiveTintColor: isTeamSession ? '#D4AF37' : '#333',
                    tabBarInactiveTintColor: isTeamSession ? '#666' : '#333',
                }}
                listeners={{
                    tabPress: (e) => {
                        if (!isTeamSession) e.preventDefault();
                    }
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: "Chat",
                    tabBarIcon: ({ color }) => (
                        <FontAwesome5
                            name="comments"
                            size={20}
                            color={isTeamSession && !isTeamCaptain ? '#333' : color}
                        />
                    ),
                    tabBarActiveTintColor: isTeamSession && !isTeamCaptain ? '#333' : '#D4AF37',
                    tabBarInactiveTintColor: isTeamSession && !isTeamCaptain ? '#333' : '#666',
                    tabBarBadge: isTeamSession && !isTeamCaptain ? undefined : (unreadCount > 0 ? unreadCount : undefined),
                    tabBarBadgeStyle: {
                        backgroundColor: '#D4AF37',
                        color: '#000',
                        fontSize: 10,
                        fontWeight: 'bold',
                    }
                }}
                listeners={{
                    tabPress: (e) => {
                        if (isTeamSession && !isTeamCaptain) {
                            e.preventDefault();
                            return;
                        }
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
