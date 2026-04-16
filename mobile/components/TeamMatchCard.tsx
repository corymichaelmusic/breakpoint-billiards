import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';
import { Linking } from 'react-native';
import { getApiBaseUrl } from '../lib/api';
import { getTeamMatchLockState } from '../utils/match';

const TEAM_MATCH_FEE_AMOUNT = 80;
const TEAM_MATCH_PAYMENT_WINDOW_DAYS = 6;

const isPaidStatus = (status?: string | null) => ['paid_cash', 'paid_online', 'waived'].includes(status || '');

const formatPaymentCountdown = (scheduledDate?: string | null, nowMs: number = Date.now()) => {
    if (!scheduledDate) return { label: 'Due date pending', overdue: false };

    const matchDateMs = new Date(scheduledDate).getTime();
    if (Number.isNaN(matchDateMs)) return { label: 'Due date pending', overdue: false };

    const deadlineMs = matchDateMs + TEAM_MATCH_PAYMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const diffMs = deadlineMs - nowMs;

    if (diffMs <= 0) {
        const overdueDays = Math.floor(Math.abs(diffMs) / (24 * 60 * 60 * 1000));
        return {
            label: overdueDays > 0 ? `Overdue by ${overdueDays}d` : 'Overdue',
            overdue: true
        };
    }

    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 0) {
        return { label: `Due in ${days}d ${hours}h`, overdue: false };
    }

    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    return { label: `Due in ${hours}h ${minutes}m`, overdue: false };
};

export default function TeamMatchCard({
    match,
    userTeamId,
    expandableCompleted = false,
    timezone = 'America/Chicago'
}: {
    match: any,
    userTeamId: string,
    expandableCompleted?: boolean,
    timezone?: string
}) {
    const router = useRouter();
    const { userId, getToken } = useAuth();
    const [expanded, setExpanded] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [isRequestingUnlock, setIsRequestingUnlock] = useState(false);
    const [hasPendingUnlockRequest, setHasPendingUnlockRequest] = useState(false);
    const [nowMs, setNowMs] = useState(Date.now());
    
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
    const isCaptain = myTeam?.captain_id === userId;
    const myPaymentStatus = isTeamA ? match.payment_status_team_a : match.payment_status_team_b;
    const hasPaidTeamMatchFee = isPaidStatus(myPaymentStatus);
    const paymentCountdown = useMemo(
        () => formatPaymentCountdown(match.scheduled_date || match.created_at, nowMs),
        [match.scheduled_date, match.created_at, nowMs]
    );

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
    const paymentBadgeClasses = hasPaidTeamMatchFee
        ? 'bg-green-500/15 border-green-500/30'
        : paymentCountdown.overdue
        ? 'bg-red-500/15 border-red-500/30'
        : 'bg-yellow-500/15 border-yellow-500/30';
    const paymentBadgeTextClasses = hasPaidTeamMatchFee
        ? 'text-green-400'
        : paymentCountdown.overdue
        ? 'text-red-400'
        : 'text-yellow-300';
    const teamNameClassName = Platform.OS === 'android' ? 'text-sm' : 'text-base';
    const lockState = getTeamMatchLockState(
        match.scheduled_date || null,
        timezone,
        !!match.is_manually_unlocked,
        match.status || 'scheduled'
    );
    const isLocked = lockState.locked && !isCompleted;
    const lockBadgeClasses = isLocked
        ? 'bg-red-500/15 border-red-500/30'
        : 'bg-green-500/15 border-green-500/30';
    const lockBadgeTextClasses = isLocked ? 'text-red-300' : 'text-green-400';

    useEffect(() => {
        if (!isCaptain || hasPaidTeamMatchFee || !isCompleted) return;

        const interval = setInterval(() => {
            setNowMs(Date.now());
        }, 60000);

        return () => clearInterval(interval);
    }, [hasPaidTeamMatchFee, isCaptain, isCompleted]);

    useEffect(() => {
        let isMounted = true;

        const fetchPendingUnlockRequest = async () => {
            if (!match?.id || !userId) return;
            if (!isLocked) {
                if (isMounted) setHasPendingUnlockRequest(false);
                return;
            }

            try {
                const token = await getToken({ template: 'supabase' });
                const supabase = createClient(
                    process.env.EXPO_PUBLIC_SUPABASE_URL!,
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    { global: { headers: { Authorization: `Bearer ${token}` } } }
                );

                const { data, error } = await supabase
                    .from('reschedule_requests')
                    .select('id')
                    .eq('team_match_id', match.id)
                    .eq('status', 'pending_operator')
                    .limit(1);

                if (!error && isMounted) {
                    setHasPendingUnlockRequest((data || []).length > 0);
                }
            } catch (error) {
                console.error('Failed to check team unlock requests:', error);
            }
        };

        fetchPendingUnlockRequest();

        return () => {
            isMounted = false;
        };
    }, [getToken, isLocked, match?.id, userId]);

    const handlePayTeamMatchFee = async () => {
        if (!match?.id || !userId) return;
        setIsPaying(true);
        try {
            const token = await getToken();
            const apiUrl = getApiBaseUrl();
            const response = await fetch(`${apiUrl}/api/create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ type: 'team_match_fee', teamMatchId: match.id, source: 'mobile' })
            });

            const rawText = await response.text();

            try {
                const data = JSON.parse(rawText);
                if (data.url) {
                    await Linking.openURL(data.url);
                } else {
                    Alert.alert('Error', data.error || 'Failed to create payment link.');
                }
            } catch {
                Alert.alert('Payment Error', `Server returned invalid response: ${response.status}`);
            }
        } catch (error) {
            console.error('Team match payment error:', error);
            Alert.alert('Error', 'Could not start payment.');
        } finally {
            setIsPaying(false);
        }
    };

    const handlePress = () => {
        if (canExpand) {
            setExpanded((current) => !current);
            return;
        }

        router.push(`/team-match/${match.id}`);
    };

    const handleRequestUnlock = async () => {
        if (!match?.id || !userId || hasPendingUnlockRequest) return;

        setIsRequestingUnlock(true);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            const { error } = await supabase
                .from('reschedule_requests')
                .insert({
                    team_match_id: match.id,
                    requester_id: userId,
                    reason: 'Team requested manual unlock',
                    status: 'pending_operator'
                });

            if (error) {
                console.error(error);
                Alert.alert('Error', 'Failed to send unlock request.');
                return;
            }

            setHasPendingUnlockRequest(true);
            Alert.alert('Unlock Requested', 'Your operator has been notified.');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'An unexpected error occurred.');
        } finally {
            setIsRequestingUnlock(false);
        }
    };

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePress}
            className={`bg-surface border rounded-xl p-4 mb-4 ${isLocked ? 'border-red-500/40' : 'border-border'}`}
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
                    <View className={`rounded-full border px-2 py-1 ${lockBadgeClasses}`}>
                        <Text className={`text-[10px] font-bold uppercase tracking-widest ${lockBadgeTextClasses}`}>
                            {isLocked ? 'Locked' : 'Unlocked'}
                        </Text>
                    </View>
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

            {isCaptain && isCompleted ? (
                <View className="mt-3">
                    <View className={`self-start rounded-full border px-3 py-1 ${paymentBadgeClasses}`}>
                        <Text className={`text-[11px] font-bold uppercase tracking-widest ${paymentBadgeTextClasses}`}>
                            {hasPaidTeamMatchFee ? 'Paid' : paymentCountdown.overdue ? `Unpaid • ${paymentCountdown.label}` : `Unpaid • ${paymentCountdown.label}`}
                        </Text>
                    </View>
                </View>
            ) : null}

            {!isCompleted ? (
                <View className="mt-3">
                    <Text className={`text-xs ${isLocked ? 'text-red-300' : 'text-green-400'}`}>
                        {isLocked
                            ? (lockState.reason || 'Locked until match day.')
                            : (match.is_manually_unlocked ? 'Unlocked by the operator.' : 'Unlocked for match day.')}
                    </Text>
                    {isLocked ? (
                        hasPendingUnlockRequest ? (
                            <Text className="text-yellow-300 text-[11px] font-bold uppercase tracking-widest mt-2">
                                Unlock request pending
                            </Text>
                        ) : (
                            <TouchableOpacity
                                onPress={handleRequestUnlock}
                                disabled={isRequestingUnlock}
                                className="self-start mt-2"
                            >
                                <Text className={`text-primary text-[11px] font-bold uppercase tracking-widest underline ${isRequestingUnlock ? 'opacity-50' : ''}`}>
                                    {isRequestingUnlock ? 'Requesting...' : 'Request Unlock'}
                                </Text>
                            </TouchableOpacity>
                        )
                    ) : null}
                </View>
            ) : null}

            {canExpand && expanded ? (
                <View className="mt-4 pt-4 border-t border-border/50">
                    {isCaptain && isCompleted ? (
                        <View className={`mb-4 rounded-lg border px-3 py-3 ${hasPaidTeamMatchFee ? 'bg-green-500/10 border-green-500/30' : paymentCountdown.overdue ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                            <View className="flex-row items-center justify-between mb-2">
                                <Text className={`text-xs font-bold uppercase tracking-widest ${hasPaidTeamMatchFee ? 'text-green-400' : paymentCountdown.overdue ? 'text-red-400' : 'text-yellow-300'}`}>
                                    {hasPaidTeamMatchFee ? 'Match Fee Paid' : 'Team Match Fee Due'}
                                </Text>
                                <Text className={`text-xs font-bold ${hasPaidTeamMatchFee ? 'text-green-400' : paymentCountdown.overdue ? 'text-red-400' : 'text-yellow-300'}`}>
                                    ${TEAM_MATCH_FEE_AMOUNT}
                                </Text>
                            </View>
                            <Text className={`text-xs mb-3 ${hasPaidTeamMatchFee ? 'text-gray-300' : paymentCountdown.overdue ? 'text-red-300' : 'text-gray-300'}`}>
                                {hasPaidTeamMatchFee ? 'Your captain payment is complete for this match.' : paymentCountdown.label}
                            </Text>
                            {!hasPaidTeamMatchFee ? (
                                <TouchableOpacity
                                    onPress={handlePayTeamMatchFee}
                                    disabled={isPaying}
                                    className={`rounded-full px-4 py-2 items-center ${isPaying ? 'bg-primary/40' : 'bg-primary'}`}
                                >
                                    <Text className="text-black text-xs font-bold uppercase tracking-widest">
                                        {isPaying ? 'Opening Payment...' : `Pay $${TEAM_MATCH_FEE_AMOUNT} Match Fee`}
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    ) : null}

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
                        const isPlayerAWinner = set.winner_team_id === match.team_a_id;
                        const isPlayerBWinner = set.winner_team_id === match.team_b_id;

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
                                        <View className="flex-row items-center">
                                            {isPlayerAWinner ? (
                                                <View className="w-2 h-2 rounded-full bg-[#D4AF37] mr-2" />
                                            ) : null}
                                            <Text className={`text-sm font-semibold ${isPlayerAWinner ? 'text-[#D4AF37]' : 'text-white'}`} numberOfLines={1}>
                                                {set.player_a?.full_name || 'Player A'}
                                            </Text>
                                        </View>
                                        <Text className="text-gray-500 text-xs">{match.team_a?.name || 'Team A'}</Text>
                                    </View>
                                    <Text className="text-gray-500 text-xs uppercase tracking-widest px-2">vs</Text>
                                    <View className="flex-1 items-end">
                                        <View className="flex-row items-center justify-end">
                                            <Text className={`text-sm font-semibold text-right ${isPlayerBWinner ? 'text-[#D4AF37]' : 'text-white'}`} numberOfLines={1}>
                                                {set.player_b?.full_name || 'Player B'}
                                            </Text>
                                            {isPlayerBWinner ? (
                                                <View className="w-2 h-2 rounded-full bg-[#D4AF37] ml-2" />
                                            ) : null}
                                        </View>
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
