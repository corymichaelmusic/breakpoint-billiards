import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function TeamMatchCard({ match, userTeamId }: { match: any, userTeamId: string }) {
    const router = useRouter();
    
    // Determine opponent team
    const isTeamA = match.team_a_id === userTeamId;
    const myTeam = isTeamA ? match.team_a : match.team_b;
    const opponentTeam = isTeamA ? match.team_b : match.team_a;

    const myWins = isTeamA ? match.wins_a : match.wins_b;
    const opponentWins = isTeamA ? match.wins_b : match.wins_a;

    const getStatusColor = () => {
        if (match.status === 'completed') return 'text-green-400';
        if (match.status === 'in_progress') return 'text-primary';
        return 'text-gray-400';
    };

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/team-match/${match.id}`)}
            className="bg-surface border border-border rounded-xl p-4 mb-4"
        >
            <View className="flex-row justify-between items-center mb-3 border-b border-border/50 pb-2">
                <View className="flex-row items-center">
                    <FontAwesome5 name="users" size={14} color="#D4AF37" className="mr-2" />
                    <Text className="text-white font-bold text-sm tracking-wider uppercase">Week {match.week_number}</Text>
                </View>
                <Text className={`text-xs font-bold uppercase tracking-wider ${getStatusColor()}`}>
                    {match.status.replace('_', ' ')}
                </Text>
            </View>

            <View className="flex-row justify-between items-center">
                {/* My Team */}
                <View className="flex-1 flex-row items-center">
                    <View className="h-10 w-10 bg-black/40 rounded-full items-center justify-center border border-primary/30 mr-3">
                        <Text className="text-white font-bold">{myTeam?.name ? myTeam.name.substring(0, 1).toUpperCase() : 'T'}</Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-white font-bold text-base" numberOfLines={1}>{myTeam?.name || 'Your Team'}</Text>
                        <Text className="text-primary font-bold text-lg">{myWins}</Text>
                    </View>
                </View>

                <View className="px-2">
                    <Text className="text-gray-500 font-bold text-xs uppercase tracking-widest">VS</Text>
                </View>

                {/* Opponent Team */}
                <View className="flex-1 flex-row items-center justify-end">
                    <View className="flex-1 items-end mr-3">
                        <Text className="text-gray-300 font-bold text-base text-right" numberOfLines={1}>{opponentTeam?.name || 'TBD'}</Text>
                        <Text className="text-gray-400 font-bold text-lg">{opponentWins}</Text>
                    </View>
                    <View className="h-10 w-10 bg-black/40 rounded-full items-center justify-center border border-border">
                        <Text className="text-gray-400 font-bold">{opponentTeam?.name ? opponentTeam.name.substring(0, 1).toUpperCase() : '?'}</Text>
                    </View>
                </View>
            </View>

        </TouchableOpacity>
    );
}
