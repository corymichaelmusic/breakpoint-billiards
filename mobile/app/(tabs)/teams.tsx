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

// ─── Captain Request Modal ──────────────────────────────────────────────────
function CaptainModal({ visible, onClose, sessionId, userId, getToken, onSuccess }: any) {
    const [submitting, setSubmitting] = useState(false);
    const [requested, setRequested] = useState(false);

    const handleRequest = async () => {
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
                        Build a 6-player roster, manage your lineup, and lead your team through the season under the 25 Breakpoint Rating cap.
                    </Text>
                </View>

                {requested ? (
                    <View style={{ backgroundColor: '#1f1f1f', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' }}>
                        <FontAwesome5 name="check-circle" size={22} color="#D4AF37" />
                        <Text style={{ color: '#D4AF37', fontWeight: 'bold', marginTop: 8 }}>Request Sent!</Text>
                        <Text style={{ color: '#888', fontSize: 12, marginTop: 4, textAlign: 'center' }}>The operator will review your request shortly.</Text>
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
            setTeam(myTeam || null);

            // Get roster for my team
            if (myTeam) {
                const { data: roster } = await supabase
                    .from('team_members')
                    .select('player_id, profiles:player_id(full_name, breakpoint_rating)')
                    .eq('team_id', myTeam.id);
                setMembers(roster || []);
            }

            // Get all teams in the session for standings
            const { data: teams } = await supabase
                .from('teams')
                .select('id, name, captain_id, profiles:captain_id(full_name)')
                .eq('league_id', currentSession.id);
            setAllTeams(teams || []);

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

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0d0d' }} edges={['top', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#D4AF37" />}
            >
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <View>
                        <Text style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>
                            {currentSession?.parentLeagueName || 'Team League'}
                        </Text>
                        <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>Teams</Text>
                    </View>
                    {/* Become a Captain button — only if not on a team */}
                    {!team && (
                        <TouchableOpacity
                            onPress={() => setShowCaptainModal(true)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
                            activeOpacity={0.8}
                        >
                            <FontAwesome5 name="crown" size={12} color="#D4AF37" />
                            <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 12 }}>
                                {captainRequest ? 'Request Pending' : 'Become Captain'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* MY TEAM */}
                {team && (
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>Your Team</Text>
                        <View style={{ backgroundColor: '#1a1a1a', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' }}>
                            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{team.name}</Text>
                                <TouchableOpacity onPress={() => router.push('/teams/manage')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={{ color: '#D4AF37', fontSize: 13 }}>Manage</Text>
                                    <FontAwesome5 name="chevron-right" size={11} color="#D4AF37" />
                                </TouchableOpacity>
                            </View>

                            {/* Roster */}
                            <View style={{ padding: 12 }}>
                                <Text style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Roster ({members.length}/6)</Text>
                                {members.length === 0 ? (
                                    <Text style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: 12 }}>No members yet. Manage your roster to add players.</Text>
                                ) : (
                                    members.map((m: any, i: number) => {
                                        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                                        const isCaptain = team.captain_id === m.player_id;
                                        return (
                                            <View key={m.player_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < members.length - 1 ? 1 : 0, borderBottomColor: '#2a2a2a' }}>
                                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                                    {isCaptain
                                                        ? <FontAwesome5 name="crown" size={13} color="#D4AF37" />
                                                        : <Text style={{ color: '#666', fontWeight: 'bold', fontSize: 12 }}>{i + 1}</Text>
                                                    }
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{profile?.full_name || 'Unknown'}</Text>
                                                    {isCaptain && <Text style={{ color: '#D4AF37', fontSize: 11 }}>Captain</Text>}
                                                </View>
                                                <Text style={{ color: '#888', fontSize: 13 }}>BP {profile?.breakpoint_rating ?? '–'}</Text>
                                            </View>
                                        );
                                    })
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
                        <View style={{ backgroundColor: '#1a1a1a', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' }}>
                            {allTeams.map((t: any, i: number) => {
                                const captain = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
                                const isMyTeam = team?.id === t.id;
                                return (
                                    <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i < allTeams.length - 1 ? 1 : 0, borderBottomColor: '#2a2a2a', backgroundColor: isMyTeam ? 'rgba(212,175,55,0.05)' : 'transparent' }}>
                                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isMyTeam ? 'rgba(212,175,55,0.2)' : '#2a2a2a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                            <Text style={{ color: isMyTeam ? '#D4AF37' : '#666', fontWeight: 'bold', fontSize: 12 }}>{i + 1}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: isMyTeam ? '#D4AF37' : '#fff', fontWeight: '600', fontSize: 14 }}>
                                                {t.name}{isMyTeam ? ' (You)' : ''}
                                            </Text>
                                            <Text style={{ color: '#555', fontSize: 11 }}>Capt: {captain?.full_name || 'Unknown'}</Text>
                                        </View>
                                        <Text style={{ color: '#444', fontSize: 12 }}>0-0</Text>
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
                onSuccess={() => { setCaptainRequest({ status: 'pending' }); setTimeout(() => setShowCaptainModal(false), 1500); }}
            />
        </SafeAreaView>
    );
}
