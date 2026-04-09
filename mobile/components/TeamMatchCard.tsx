import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function TeamMatchCard({
    match,
    userTeamId,
    expandableCompleted = false
}: {
    match: any,
    userTeamId: string,
    expandableCompleted?: boolean
}) {
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    
    // Determine opponent team
    const isTeamA = match.team_a_id === userTeamId;
    const myTeam = isTeamA ? match.team_a : match.team_b;
    const opponentTeam = isTeamA ? match.team_b : match.team_a;

    const myWins = isTeamA ? match.wins_a : match.wins_b;
    const opponentWins = isTeamA ? match.wins_b : match.wins_a;
    const mySubmission = Array.isArray(match.team_match_captain_submissions)
        ? match.team_match_captain_submissions.find((submission: any) => submission.team_id === userTeamId)
        : null;
    const formattedMatchDate = (() => {
        if (!match.scheduled_date) return 'Date TBD';

        const datePart = String(match.scheduled_date).split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        if (!year || !month || !day) return 'Date TBD';

        return new Date(year, month - 1, day).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    })();
    const displayStatus =
        match.status === 'completed'
            ? 'completed'
            : mySubmission?.verification_status === 'submitted'
            ? 'pending_verification'
            : mySubmission?.verification_status === 'verified'
            ? 'verified'
            : mySubmission?.verification_status === 'disputed'
            ? 'in_progress'
            : mySubmission?.verification_status === 'draft'
            ? 'in_progress'
            : match.status;
    const isCompleted = displayStatus === 'completed';
    const canExpand = expandableCompleted && isCompleted;

    const sortedSets = useMemo(() => (
        Array.isArray(match.team_match_sets)
            ? [...match.team_match_sets].sort((a, b) => (a.set_number || 0) - (b.set_number || 0))
            : []
    ), [match.team_match_sets]);

    const stats = useMemo(() => {
        return sortedSets.reduce((acc, set) => {
            const gameType = set.game_type;
            const winnerTeamId = set.winner_team_id;
            const winnerBucket = winnerTeamId === match.team_a_id ? 'a' : winnerTeamId === match.team_b_id ? 'b' : null;

            if (gameType === '8ball' && winnerBucket === 'a') acc.a8 += 1;
            if (gameType === '8ball' && winnerBucket === 'b') acc.b8 += 1;
            if (gameType === '9ball' && winnerBucket === 'a') acc.a9 += 1;
            if (gameType === '9ball' && winnerBucket === 'b') acc.b9 += 1;

            return acc;
        }, { a8: 0, b8: 0, a9: 0, b9: 0 });
    }, [match.team_a_id, match.team_b_id, sortedSets]);

    const getStatusColor = () => {
        if (displayStatus === 'completed' || displayStatus === 'verified') return 'text-green-400';
        if (displayStatus === 'pending_verification') return 'text-amber-300';
        if (displayStatus === 'in_progress') return 'text-primary';
        return 'text-gray-400';
    };
    const teamNameClassName = Platform.OS === 'android' ? 'text-sm' : 'text-base';

    const handlePress = () => {
        if (canExpand) {
            setExpanded((current) => !current);
            return;
        }

        router.push(`/team-match/${match.id}`);
    };

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePress}
            className="bg-surface border border-border rounded-xl p-4 mb-4"
        >
            <View className="flex-row justify-between items-center mb-3 border-b border-border/50 pb-2">
                <View className="flex-row items-center">
                    <FontAwesome5 name="users" size={14} color="#D4AF37" className="mr-2" />
                    <View>
                        <Text className="text-white font-bold text-sm tracking-wider uppercase">Week {match.week_number}</Text>
                        <Text className="text-gray-500 text-[11px] font-bold uppercase tracking-wider mt-1">
                            {formattedMatchDate}
                        </Text>
                    </View>
                </View>
                <View className="flex-row items-center gap-2">
                    <Text className={`text-xs font-bold uppercase tracking-wider ${getStatusColor()}`}>
                        {displayStatus.replace(/_/g, ' ')}
                    </Text>
                    {canExpand ? (
                        <FontAwesome5 name={expanded ? "chevron-up" : "chevron-down"} size={11} color="#9CA3AF" />
                    ) : null}
                </View>
            </View>

            <View className="flex-row justify-between items-center">
                {/* My Team */}
                <View className="flex-1 flex-row items-center">
                    <View className="h-10 w-10 bg-black/40 rounded-full items-center justify-center border border-primary/30 mr-3">
                        <Text className="text-white font-bold">{myTeam?.name ? myTeam.name.substring(0, 1).toUpperCase() : 'T'}</Text>
                    </View>
                    <View className="flex-1">
                        <Text className={`text-white font-bold ${teamNameClassName}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{myTeam?.name || 'Your Team'}</Text>
                        <Text className="text-primary font-bold text-lg">{myWins}</Text>
                    </View>
                </View>

                <View className="px-2">
                    <Text className="text-gray-500 font-bold text-xs uppercase tracking-widest">VS</Text>
                </View>

                {/* Opponent Team */}
                <View className="flex-1 flex-row items-center justify-end">
                    <View className="flex-1 items-end mr-3">
                        <Text className={`text-gray-300 font-bold text-right ${teamNameClassName}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{opponentTeam?.name || 'TBD'}</Text>
                        <Text className="text-gray-400 font-bold text-lg">{opponentWins}</Text>
                    </View>
                    <View className="h-10 w-10 bg-black/40 rounded-full items-center justify-center border border-border">
                        <Text className="text-gray-400 font-bold">{opponentTeam?.name ? opponentTeam.name.substring(0, 1).toUpperCase() : '?'}</Text>
                    </View>
                </View>
            </View>

            {canExpand && expanded ? (
                <View className="mt-4 pt-4 border-t border-border/50">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-1 items-center">
                            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider">8-Ball</Text>
                            <Text className="text-white font-bold mt-1">
                                {stats.a8}-{stats.b8}
                            </Text>
                        </View>
                        <View className="flex-1 items-center">
                            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider">9-Ball</Text>
                            <Text className="text-white font-bold mt-1">
                                {stats.a9}-{stats.b9}
                            </Text>
                        </View>
                    </View>

                    {sortedSets.map((set: any) => {
                        const setWinnerName =
                            set.winner_team_id === match.team_a_id ? match.team_a?.name :
                            set.winner_team_id === match.team_b_id ? match.team_b?.name :
                            'Unscored';

                        return (
                            <View key={set.id || set.set_number} className="bg-black/20 border border-border/50 rounded-lg px-3 py-3 mb-2">
                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className="text-gray-300 font-bold text-xs uppercase tracking-wider">
                                        Set {set.set_number} • {set.game_type === '8ball' ? '8-Ball' : '9-Ball'}
                                    </Text>
                                    <Text className="text-green-400 text-xs font-bold uppercase tracking-wider">
                                        {setWinnerName}
                                    </Text>
                                </View>
                                <View className="flex-row justify-between items-center">
                                    <View className="flex-1">
                                        <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                                            {set.player_a?.full_name || 'Player A'}
                                        </Text>
                                        <Text className="text-gray-500 text-xs">{match.team_a?.name || 'Team A'}</Text>
                                    </View>
                                    <Text className="text-gray-500 text-xs uppercase tracking-widest px-2">vs</Text>
                                    <View className="flex-1 items-end">
                                        <Text className="text-white text-sm font-semibold text-right" numberOfLines={1}>
                                            {set.player_b?.full_name || 'Player B'}
                                        </Text>
                                        <Text className="text-gray-500 text-xs text-right">{match.team_b?.name || 'Team B'}</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            ) : null}
        </TouchableOpacity>
    );
}
