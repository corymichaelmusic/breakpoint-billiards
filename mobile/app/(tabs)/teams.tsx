import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, Modal,
    ActivityIndicator, Alert, Pressable, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';
import { useSession } from '../../lib/SessionContext';
import { getBreakpointLevel } from '../../utils/rating';

function formatPercent(wins: number, played: number) {
    if (!played) return '0%';
    return `${Math.round((wins / played) * 100)}%`;
}

function formatRecord(wins: number, losses: number) {
    return `${wins}-${losses}`;
}

function formatBreakpointSum(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getTeamBreakpointRangeLabel(members: any[]) {
    if (!members.length) return null;

    const levels = members
        .map((member) => {
            const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
            return parseFloat(getBreakpointLevel(profile?.breakpoint_rating));
        })
        .filter((level) => Number.isFinite(level))
        .sort((a, b) => a - b);

    if (!levels.length) return null;

    const groupSize = Math.min(4, levels.length);
    const lowTotal = levels.slice(0, groupSize).reduce((sum, level) => sum + level, 0);
    const highTotal = levels.slice(-groupSize).reduce((sum, level) => sum + level, 0);

    return `BP Range ${formatBreakpointSum(lowTotal)}-${formatBreakpointSum(highTotal)}`;
}

function sortRosterMembers(members: any[], captainId?: string) {
    return [...members].sort((a, b) => {
        if (a.player_id === captainId) return -1;
        if (b.player_id === captainId) return 1;

        const aRating = Array.isArray(a.profiles) ? a.profiles[0]?.breakpoint_rating ?? 0 : a.profiles?.breakpoint_rating ?? 0;
        const bRating = Array.isArray(b.profiles) ? b.profiles[0]?.breakpoint_rating ?? 0 : b.profiles?.breakpoint_rating ?? 0;
        return bRating - aRating;
    });
}

// ─── Captain Request Modal ──────────────────────────────────────────────────
function CaptainModal({ visible, onClose, sessionId, userId, getToken, onSuccess, existingRequest }: any) {
    const [submitting, setSubmitting] = useState(false);
    const [requested, setRequested] = useState(false);
    const alreadyRequested = Boolean(existingRequest || requested);

    useEffect(() => {
        if (visible) {
            setRequested(Boolean(existingRequest));
        } else {
            setRequested(false);
            setSubmitting(false);
        }
    }, [visible, existingRequest]);

    const handleRequest = async () => {
        if (alreadyRequested) return;
        setSubmitting(true);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );
            const { error } = await supabase.from('captain_requests')
                .upsert({ league_id: sessionId, player_id: userId, status: 'pending' }, { onConflict: 'league_id,player_id' });
            if (error) throw error;
            setRequested(true);
            onSuccess?.();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to send request.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }} onPress={onClose} />
            <View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: 48 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 20 }} />

                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <View style={{ backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 999, width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                        <FontAwesome5 name="crown" size={28} color="#D4AF37" />
                    </View>
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Become a Team Captain</Text>
                    <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                        Build a 6-player roster, manage your lineup, and lead your team through the session under the 27 Breakpoint Rating cap.
                    </Text>
                </View>

                {alreadyRequested ? (
                    <View style={{ backgroundColor: '#1f1f1f', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' }}>
                        <FontAwesome5 name="check-circle" size={22} color="#D4AF37" />
                        <Text style={{ color: '#D4AF37', fontWeight: 'bold', marginTop: 8 }}>Request Pending</Text>
                        <Text style={{ color: '#888', fontSize: 12, marginTop: 4, textAlign: 'center' }}>The operator is reviewing your captain request.</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={handleRequest}
                        disabled={submitting}
                        style={{ backgroundColor: '#D4AF37', borderRadius: 12, padding: 16, alignItems: 'center' }}
                        activeOpacity={0.8}
                    >
                        {submitting
                            ? <ActivityIndicator color="#000" />
                            : <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 }}>Send Captain Request</Text>
                        }
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', paddingTop: 16 }}>
                    <Text style={{ color: '#666', fontSize: 14 }}>Dismiss</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

// ─── Stat Pill ───────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string | number }) {
    return (
        <View style={{ flex: 1, backgroundColor: '#1f1f1f', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' }}>
            <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 18 }}>{value}</Text>
            <Text style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{label}</Text>
        </View>
    );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function TeamsScreen() {
    const { userId, getToken } = useAuth();
    const { currentSession } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isTeamLeague, setIsTeamLeague] = useState(false);
    const [team, setTeam] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [allTeams, setAllTeams] = useState<any[]>([]);
    const [captainRequest, setCaptainRequest] = useState<any>(null);
    const [showCaptainModal, setShowCaptainModal] = useState(false);
    const [expandedTeams, setExpandedTeams] = useState<string[]>([]);

    const getStatusText = (status?: string | null) => {
        switch (status) {
            case 'pending':
                return 'Pending operator approval';
            case 'submitted':
                return 'Roster submitted';
            case 'approved':
                return 'Roster approved';
            case 'edit_requested':
                return 'Edit request pending';
            default:
                return 'Roster editable';
        }
    };

    const toggleTeamExpanded = (teamId: string) => {
        setExpandedTeams(prev =>
            prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
        );
    };

    const fetchData = useCallback(async () => {
        if (!userId || !currentSession?.id) { setLoading(false); return; }
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            // Check team league
            const { data: leagueData } = await supabase.from('leagues').select('is_team_league').eq('id', currentSession.id).single();
            if (!leagueData?.is_team_league) { setIsTeamLeague(false); setLoading(false); setRefreshing(false); return; }
            setIsTeamLeague(true);

            // Check user's team
            const { data: capTeam } = await supabase.from('teams').select('*').eq('league_id', currentSession.id).eq('captain_id', userId).maybeSingle();
            const { data: memberTeamData } = await supabase.from('team_members').select('teams!inner(*)').eq('player_id', userId).eq('teams.league_id', currentSession.id).maybeSingle();
            const memberTeam: any = memberTeamData?.teams;
            const myTeam = capTeam || (!Array.isArray(memberTeam) ? memberTeam : null);

            // Get all teams in the session for standings
            const { data: teams } = await supabase
                .from('teams')
                .select('id, name, captain_id, status, tid, profiles:captain_id(full_name)')
                .eq('league_id', currentSession.id);

            const teamIds = (teams || []).map(t => t.id);

            const { data: rosterRows } = teamIds.length > 0
                ? await supabase
                    .from('team_members')
                    .select('team_id, player_id, profiles:player_id(id, full_name, breakpoint_rating)')
                    .in('team_id', teamIds)
                : { data: [] as any[] };

            const { data: teamMatchesData } = await supabase
                .from('team_matches')
                .select('*')
                .eq('league_id', currentSession.id);

            const { data: sessionMatches } = await supabase
                .from('matches')
                .select(`
                    player1_id,
                    player2_id,
                    status_8ball,
                    status_9ball,
                    winner_id_8ball,
                    winner_id_9ball
                `)
                .eq('league_id', currentSession.id);

            const playerStatsMap = new Map<string, { wins8: number; played8: number; wins9: number; played9: number }>();

            (sessionMatches || []).forEach((match: any) => {
                const ids = [match.player1_id, match.player2_id];
                ids.forEach((playerId: string) => {
                    if (!playerStatsMap.has(playerId)) {
                        playerStatsMap.set(playerId, { wins8: 0, played8: 0, wins9: 0, played9: 0 });
                    }
                });

                if (match.status_8ball === 'finalized') {
                    ids.forEach((playerId: string) => {
                        const stats = playerStatsMap.get(playerId)!;
                        stats.played8 += 1;
                        if (match.winner_id_8ball === playerId) stats.wins8 += 1;
                    });
                }

                if (match.status_9ball === 'finalized') {
                    ids.forEach((playerId: string) => {
                        const stats = playerStatsMap.get(playerId)!;
                        stats.played9 += 1;
                        if (match.winner_id_9ball === playerId) stats.wins9 += 1;
                    });
                }
            });

            const membersByTeam = new Map<string, any[]>();
            (rosterRows || []).forEach((row: any) => {
                const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
                const stats = playerStatsMap.get(row.player_id) || { wins8: 0, played8: 0, wins9: 0, played9: 0 };
                const enrichedMember = {
                    ...row,
                    profiles: profile,
                    stats: {
                        wins8: stats.wins8,
                        losses8: Math.max(stats.played8 - stats.wins8, 0),
                        winRate8: formatPercent(stats.wins8, stats.played8),
                        wins9: stats.wins9,
                        losses9: Math.max(stats.played9 - stats.wins9, 0),
                        winRate9: formatPercent(stats.wins9, stats.played9),
                        winsOverall: stats.wins8 + stats.wins9,
                        lossesOverall: Math.max((stats.played8 - stats.wins8) + (stats.played9 - stats.wins9), 0),
                        winRateOverall: formatPercent(stats.wins8 + stats.wins9, stats.played8 + stats.played9),
                    }
                };

                const existing = membersByTeam.get(row.team_id) || [];
                existing.push(enrichedMember);
                membersByTeam.set(row.team_id, existing);
            });

            const enrichedTeams = (teams || []).map((teamRow: any) => {
                let wins = 0;
                let losses = 0;

                (teamMatchesData || []).forEach((match: any) => {
                    if (match.team_a_id === teamRow.id) {
                        wins += match.wins_a || 0;
                        losses += match.losses_a || 0;
                    } else if (match.team_b_id === teamRow.id) {
                        wins += match.wins_b || 0;
                        losses += match.losses_b || 0;
                    }
                });

                const teamMembers = sortRosterMembers(membersByTeam.get(teamRow.id) || [], teamRow.captain_id);
                const wins8 = teamMembers.reduce((sum, member) => sum + (member.stats?.wins8 || 0), 0);
                const losses8 = teamMembers.reduce((sum, member) => sum + (member.stats?.losses8 || 0), 0);
                const wins9 = teamMembers.reduce((sum, member) => sum + (member.stats?.wins9 || 0), 0);
                const losses9 = teamMembers.reduce((sum, member) => sum + (member.stats?.losses9 || 0), 0);
                const overallWins = teamMembers.reduce((sum, member) => sum + (member.stats?.winsOverall || 0), 0);
                const overallLosses = teamMembers.reduce((sum, member) => sum + (member.stats?.lossesOverall || 0), 0);

                return {
                    ...teamRow,
                    members: teamMembers,
                    wins,
                    losses,
                    recordText: `${wins}-${losses}`,
                    sessionStats: {
                        overallRecord: formatRecord(overallWins, overallLosses),
                        overallPct: formatPercent(overallWins, overallWins + overallLosses),
                        record8: formatRecord(wins8, losses8),
                        pct8: formatPercent(wins8, wins8 + losses8),
                        record9: formatRecord(wins9, losses9),
                        pct9: formatPercent(wins9, wins9 + losses9),
                    }
                };
            });

            setAllTeams(enrichedTeams);

            const enrichedMyTeam = myTeam ? enrichedTeams.find(t => t.id === myTeam.id) || myTeam : null;
            setTeam(enrichedMyTeam || null);
            setMembers(enrichedMyTeam?.members || []);

            // Captain request status
            if (!myTeam) {
                const { data: req } = await supabase.from('captain_requests').select('*').eq('league_id', currentSession.id).eq('player_id', userId).maybeSingle();
                setCaptainRequest(req || null);
            }
        } catch (e) {
            console.error('TeamsScreen error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId, currentSession?.id, getToken]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#D4AF37" />
            </SafeAreaView>
        );
    }

    if (!isTeamLeague) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <FontAwesome5 name="users" size={40} color="#222" />
                <Text style={{ color: '#444', textAlign: 'center', marginTop: 16 }}>Teams are only available in team league sessions.</Text>
            </SafeAreaView>
        );
    }

    const renderRosterMember = (member: any, captainId: string, index: number) => {
        const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
        const isCaptain = captainId === member.player_id;
        const isCurrentUser = member.player_id === userId;

        const content = (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    {isCaptain
                        ? <FontAwesome5 name="crown" size={13} color="#D4AF37" />
                        : <Text style={{ color: '#666', fontWeight: 'bold', fontSize: 12 }}>{index + 1}</Text>
                    }
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, flex: 1 }}>
                            {profile?.full_name || 'Unknown'}
                        </Text>
                        <Text style={{ color: '#888', fontSize: 13 }}>BP {getBreakpointLevel(profile?.breakpoint_rating)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                        {isCaptain && <Text style={{ color: '#D4AF37', fontSize: 11 }}>Captain</Text>}
                        <Text style={{ color: '#6B7280', fontSize: 11 }}>
                            OVR {formatRecord(member.stats?.winsOverall || 0, member.stats?.lossesOverall || 0)} {member.stats?.winRateOverall || '0%'}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 8 }}>
                        <Text style={{ color: '#6B7280', fontSize: 11 }}>
                            8B {formatRecord(member.stats?.wins8 || 0, member.stats?.losses8 || 0)} {member.stats?.winRate8 || '0%'}
                        </Text>
                        <Text style={{ color: '#6B7280', fontSize: 11 }}>
                            9B {formatRecord(member.stats?.wins9 || 0, member.stats?.losses9 || 0)} {member.stats?.winRate9 || '0%'}
                        </Text>
                    </View>
                </View>
            </View>
        );

        if (isCurrentUser) {
            return <View key={member.player_id}>{content}</View>;
        }

        return (
            <TouchableOpacity
                key={member.player_id}
                onPress={() => router.push(`/player/${member.player_id}`)}
                activeOpacity={0.8}
            >
                {content}
            </TouchableOpacity>
        );
    };

    const teamBreakpointRangeLabel = getTeamBreakpointRangeLabel(members);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0d0d' }} edges={['bottom', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#D4AF37" />}
            >
                {/* Header */}
                <View style={{ marginBottom: 12, marginTop: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <Text
                            style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, flex: 1, flexShrink: 1, paddingRight: 8 }}
                            numberOfLines={1}
                        >
                            {currentSession?.parentLeagueName || 'Team League'}
                        </Text>
                        {!team && (
                            <TouchableOpacity
                                onPress={() => !captainRequest && setShowCaptainModal(true)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0, opacity: captainRequest ? 0.75 : 1 }}
                                activeOpacity={captainRequest ? 1 : 0.8}
                            >
                                <FontAwesome5 name="crown" size={10} color="#D4AF37" />
                                <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 10.5 }}>
                                    {captainRequest ? 'Request Pending' : 'Become a Captain'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text
                            style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', flex: 1, flexShrink: 1, paddingRight: 8 }}
                            numberOfLines={1}
                        >
                            {currentSession?.name || 'Teams'}
                        </Text>
                    </View>
                </View>

                {/* MY TEAM */}
                {team && (
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>Your Team</Text>
                        <View style={{ backgroundColor: '#1a1a1a', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' }}>
                            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{team.name}</Text>
                                        <Text style={{ color: '#888', fontSize: 13, fontWeight: '600' }}>
                                            {team.sessionStats?.overallRecord || '0-0'} {team.sessionStats?.overallPct || '0%'}
                                        </Text>
                                    </View>
                                    <Text style={{ color: '#D4AF37', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 4 }}>
                                        {getStatusText(team.status)}
                                    </Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                                        <Text style={{ color: '#888', fontSize: 11 }}>
                                            8B {team.sessionStats?.record8 || '0-0'} {team.sessionStats?.pct8 || '0%'}
                                        </Text>
                                        <Text style={{ color: '#888', fontSize: 11 }}>
                                            9B {team.sessionStats?.record9 || '0-0'} {team.sessionStats?.pct9 || '0%'}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => router.push('/teams/manage')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={{ color: '#D4AF37', fontSize: 13 }}>Manage</Text>
                                    <FontAwesome5 name="chevron-right" size={11} color="#D4AF37" />
                                </TouchableOpacity>
                            </View>

                            {/* Roster */}
                            <View style={{ padding: 12 }}>
                                <Text style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                    {`Roster (${members.length}/6)${teamBreakpointRangeLabel ? ` • ${teamBreakpointRangeLabel}` : ''}`}
                                </Text>
                                {members.length === 0 ? (
                                    <Text style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: 12 }}>No members yet. Manage your roster to add players.</Text>
                                ) : (
                                    members.map((member: any, index: number) => renderRosterMember(member, team.captain_id, index))
                                )}
                            </View>
                        </View>
                    </View>
                )}

                {/* ALL TEAMS / STANDINGS */}
                {allTeams.length > 0 && (
                    <View>
                        <Text style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                            {team ? 'All Teams' : 'Teams in Session'}
                        </Text>
                        <View style={{ gap: 12 }}>
                            {allTeams.map((t: any, i: number) => {
                                const captain = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
                                const isMyTeam = team?.id === t.id;
                                const isExpanded = expandedTeams.includes(t.id);
                                const breakpointRangeLabel = getTeamBreakpointRangeLabel(t.members || []);

                                return (
                                    <View key={t.id} style={{ backgroundColor: '#1a1a1a', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' }}>
                                        <TouchableOpacity
                                            onPress={() => toggleTeamExpanded(t.id)}
                                            activeOpacity={0.85}
                                            style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: isMyTeam ? 'rgba(212,175,55,0.05)' : 'transparent' }}
                                        >
                                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isMyTeam ? 'rgba(212,175,55,0.2)' : '#2a2a2a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                                <Text style={{ color: isMyTeam ? '#D4AF37' : '#666', fontWeight: 'bold', fontSize: 12 }}>{i + 1}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                                    <Text style={{ color: isMyTeam ? '#D4AF37' : '#fff', fontWeight: '600', fontSize: 14 }}>
                                                        {t.name}{isMyTeam ? ' (You)' : ''}
                                                    </Text>
                                                    <Text style={{ color: '#888', fontSize: 12, fontWeight: '600' }}>
                                                        {t.sessionStats?.overallRecord || '0-0'} {t.sessionStats?.overallPct || '0%'}
                                                    </Text>
                                                </View>
                                                <Text style={{ color: '#555', fontSize: 11 }}>Capt: {captain?.full_name || 'Unknown'}</Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                                    <Text style={{ color: '#777', fontSize: 10 }}>
                                                        8B {t.sessionStats?.record8 || '0-0'} {t.sessionStats?.pct8 || '0%'}
                                                    </Text>
                                                    <Text style={{ color: '#777', fontSize: 10 }}>
                                                        9B {t.sessionStats?.record9 || '0-0'} {t.sessionStats?.pct9 || '0%'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <FontAwesome5 name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={isMyTeam ? '#D4AF37' : '#666'} />
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#2a2a2a' }}>
                                                <Text style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginVertical: 8 }}>
                                                    {`Roster (${t.members?.length || 0}/6)${breakpointRangeLabel ? ` • ${breakpointRangeLabel}` : ''}`}
                                                </Text>
                                                {(t.members || []).length > 0 ? (
                                                    t.members.map((member: any, index: number) => renderRosterMember(member, t.captain_id, index))
                                                ) : (
                                                    <Text style={{ color: '#444', fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                                                        No roster submitted yet.
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Empty state — no teams yet */}
                {allTeams.length === 0 && !team && (
                    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                        <FontAwesome5 name="users" size={36} color="#1f1f1f" />
                        <Text style={{ color: '#333', marginTop: 14, textAlign: 'center' }}>No teams have been formed yet.</Text>
                        <Text style={{ color: '#2a2a2a', marginTop: 6, fontSize: 13, textAlign: 'center' }}>Be the first — tap "Become Captain" above.</Text>
                    </View>
                )}
            </ScrollView>

            {/* Captain Request Modal */}
            <CaptainModal
                visible={showCaptainModal}
                onClose={() => setShowCaptainModal(false)}
                sessionId={currentSession?.id}
                userId={userId}
                getToken={getToken}
                existingRequest={captainRequest}
                onSuccess={() => { setCaptainRequest({ status: 'pending' }); setTimeout(() => setShowCaptainModal(false), 1500); }}
            />
        </SafeAreaView>
    );
}
