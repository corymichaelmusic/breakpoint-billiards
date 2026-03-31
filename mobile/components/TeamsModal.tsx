import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, Modal, ScrollView,
    ActivityIndicator, Alert, Pressable
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';
import { useSession } from '../lib/SessionContext';

interface Props {
    visible: boolean;
    onClose: () => void;
}

export default function TeamsModal({ visible, onClose }: Props) {
    const { userId, getToken } = useAuth();
    const { currentSession } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [isTeamLeague, setIsTeamLeague] = useState(false);
    const [team, setTeam] = useState<any>(null);
    const [captainRequest, setCaptainRequest] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);

    const getStatusText = (status?: string | null) => {
        switch (status) {
            case 'pending':
                return 'Pending operator approval';
            case 'submitted':
                return 'Roster submitted for approval';
            case 'approved':
                return 'Roster approved and locked';
            case 'edit_requested':
                return 'Edit request pending approval';
            default:
                return 'Roster is still editable';
        }
    };

    const fetchTeamStatus = useCallback(async () => {
        if (!userId || !currentSession?.id) { setLoading(false); return; }
        setLoading(true);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            const { data: leagueData } = await supabase
                .from('leagues').select('is_team_league')
                .eq('id', currentSession.id).single();

            if (!leagueData?.is_team_league) { setIsTeamLeague(false); setLoading(false); return; }
            setIsTeamLeague(true);

            const { data: capTeam } = await supabase
                .from('teams').select('*')
                .eq('league_id', currentSession.id).eq('captain_id', userId).maybeSingle();

            if (capTeam) { setTeam(capTeam); setLoading(false); return; }

            const { data: memberData } = await supabase
                .from('team_members').select('teams!inner(*)')
                .eq('player_id', userId).eq('teams.league_id', currentSession.id).maybeSingle();

            const memberTeam: any = memberData?.teams;
            if (memberTeam && !Array.isArray(memberTeam)) { setTeam(memberTeam); setLoading(false); return; }

            setTeam(null);
            const { data: reqData } = await supabase
                .from('captain_requests').select('*')
                .eq('league_id', currentSession.id).eq('player_id', userId).maybeSingle();
            setCaptainRequest(reqData || null);
        } catch (e) {
            console.error('TeamsModal error:', e);
        } finally {
            setLoading(false);
        }
    }, [userId, currentSession?.id, getToken]);

    useEffect(() => {
        if (visible) fetchTeamStatus();
    }, [visible, fetchTeamStatus]);

    const handleRequestCaptain = async () => {
        if (!userId || !currentSession?.id) return;
        setSubmitting(true);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );
            const { error } = await supabase.from('captain_requests')
                .upsert({ league_id: currentSession.id, player_id: userId, status: 'pending' }, { onConflict: 'league_id,player_id' });
            if (error) throw error;
            Alert.alert('Request Sent!', 'Your captain request has been sent to the operator.');
            await fetchTeamStatus();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to send request.');
        } finally {
            setSubmitting(false);
        }
    };

    const goTo = (path: string) => { onClose(); setTimeout(() => router.push(path as any), 300); };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={onClose} />

            <View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                {/* Handle */}
                <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#444' }} />
                </View>

                <ScrollView style={{ paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 40 }}>
                    {loading ? (
                        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                            <ActivityIndicator color="#D4AF37" />
                        </View>
                    ) : !isTeamLeague ? (
                        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                            <FontAwesome5 name="users" size={32} color="#333" />
                            <Text style={{ color: '#555', textAlign: 'center', marginTop: 12 }}>
                                Teams are only available in team league sessions.
                            </Text>
                        </View>
                    ) : team ? (
                        // On a team
                        <View style={{ paddingTop: 20 }}>
                            <Text style={{ color: '#888', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Your Team</Text>
                            <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>{team.name}</Text>
                            <View style={{ alignSelf: 'flex-start', backgroundColor: '#1f1f1f', borderRadius: 999, borderWidth: 1, borderColor: '#333', paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16 }}>
                                <Text style={{ color: '#D4AF37', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                                    {getStatusText(team.status)}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => goTo('/teams/manage')}
                                style={{ backgroundColor: '#D4AF37', borderRadius: 12, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
                                activeOpacity={0.8}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <FontAwesome5 name="users" size={18} color="#000" />
                                    <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Manage Roster</Text>
                                </View>
                                <FontAwesome5 name="chevron-right" size={14} color="#000" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => goTo('/teams/manage')}
                                style={{ backgroundColor: '#1f1f1f', borderRadius: 12, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#333' }}
                                activeOpacity={0.8}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <FontAwesome5 name="edit" size={16} color="#D4AF37" />
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>View Team Details</Text>
                                </View>
                                <FontAwesome5 name="chevron-right" size={14} color="#555" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        // Not on a team
                        <View style={{ paddingTop: 24 }}>
                            <View style={{ alignItems: 'center', marginBottom: 24 }}>
                                <View style={{ backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 999, width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                    <FontAwesome5 name="crown" size={30} color="#D4AF37" />
                                </View>
                                <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>Become a Team Captain</Text>
                                <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                                    As a captain, you'll build your roster, manage your lineup, and lead your team through the season.
                                </Text>
                            </View>

                            {captainRequest ? (
                                <View style={{ backgroundColor: '#1f1f1f', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 }}>
                                    <FontAwesome5 name="clock" size={20} color="#D4AF37" />
                                    <Text style={{ color: '#D4AF37', fontWeight: 'bold', marginTop: 10, marginBottom: 4 }}>Request Pending</Text>
                                    <Text style={{ color: '#888', fontSize: 13, textAlign: 'center' }}>Your request is awaiting operator review.</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={handleRequestCaptain}
                                    disabled={submitting}
                                    style={{ backgroundColor: '#D4AF37', borderRadius: 12, padding: 18, alignItems: 'center', marginBottom: 16 }}
                                    activeOpacity={0.8}
                                >
                                    {submitting ? <ActivityIndicator color="#000" /> : (
                                        <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 }}>Send Captain Request</Text>
                                    )}
                                </TouchableOpacity>
                            )}

                            <View style={{ backgroundColor: '#1f1f1f', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 16 }}>
                                <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Captain Responsibilities</Text>
                                {[
                                    { icon: 'user-friends', text: 'Build and manage a 6-player roster (including yourself)' },
                                    { icon: 'chess-king', text: 'Put up players for each match set' },
                                    { icon: 'star', text: 'Manage your 25 Breakpoint Rating cap' },
                                ].map((item, i) => (
                                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i < 2 ? 12 : 0 }}>
                                        <FontAwesome5 name={item.icon as any} size={15} color="#D4AF37" style={{ width: 22 }} />
                                        <Text style={{ color: '#ccc', fontSize: 13, flex: 1, marginLeft: 8 }}>{item.text}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}
