import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useSession, Session } from '../lib/SessionContext';

interface SessionSwitcherModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function SessionSwitcherModal({ visible, onClose }: SessionSwitcherModalProps) {
    const { sessions, currentSession, setCurrentSession, setPrimarySession } = useSession();
    const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

    const handleSelectSession = (session: Session) => {
        setCurrentSession(session);
        onClose();
    };

    const handleSetPrimary = async (sessionId: string) => {
        setSettingPrimary(sessionId);
        await setPrimarySession(sessionId);
        setSettingPrimary(null);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <Pressable
                className="flex-1 bg-black/70 justify-end"
                onPress={onClose}
            >
                <Pressable
                    className="bg-surface rounded-t-3xl max-h-[70%]"
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
                        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>Switch Session</Text>
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <Ionicons name="close" size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    {/* Tip */}
                    <View className="px-6 py-2 bg-surface-hover">
                        <Text style={{ color: '#9CA3AF', fontSize: 12 }}>
                            <Ionicons name="star" size={12} color="#D4AF37" /> = Primary session (opens on login). Tap star to change.
                        </Text>
                    </View>

                    {/* Session List */}
                    <ScrollView className="px-4 py-4" contentContainerStyle={{ paddingBottom: 40 }}>
                        {sessions.length === 0 ? (
                            <View className="items-center py-10">
                                <FontAwesome5 name="calendar-times" size={40} color="#6B7280" />
                                <Text className="text-gray-400 mt-4">No active sessions</Text>
                            </View>
                        ) : (
                            sessions.map((session) => {
                                const isSelected = currentSession?.id === session.id;
                                const isPrimary = session.isPrimary;
                                const isSettingPrimary = settingPrimary === session.id;

                                return (
                                    <TouchableOpacity
                                        key={session.id}
                                        onPress={() => handleSelectSession(session)}
                                        className={`
                                            flex-row items-center p-4 rounded-xl mb-3 border
                                            ${isSelected ? 'bg-primary/20 border-primary' : 'bg-background border-border'}
                                        `}
                                        activeOpacity={0.7}
                                    >
                                        {/* Session Info */}
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                <Text style={{
                                                    fontWeight: 'bold',
                                                    fontSize: 18,
                                                    color: isSelected ? '#D4AF37' : '#FFFFFF'
                                                }}>
                                                    {session.name}
                                                </Text>
                                                {isPrimary && (
                                                    <Ionicons
                                                        name="star"
                                                        size={16}
                                                        color="#D4AF37"
                                                        style={{ marginLeft: 8 }}
                                                    />
                                                )}
                                            </View>
                                            {session.parentLeagueName && (
                                                <Text style={{ color: '#9CA3AF', fontSize: 14 }}>
                                                    {session.parentLeagueName}
                                                </Text>
                                            )}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                                <View style={{
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 2,
                                                    borderRadius: 9999,
                                                    backgroundColor: session.status === 'active' ? 'rgba(20, 83, 45, 0.5)' : 'rgba(113, 63, 18, 0.5)'
                                                }}>
                                                    <Text style={{
                                                        fontSize: 12,
                                                        fontWeight: 'bold',
                                                        textTransform: 'uppercase',
                                                        color: session.status === 'active' ? '#4ADE80' : '#FACC15'
                                                    }}>
                                                        {session.status}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Primary Button */}
                                        <TouchableOpacity
                                            onPress={() => handleSetPrimary(session.id)}
                                            className="p-2"
                                            disabled={isPrimary || isSettingPrimary}
                                        >
                                            <Ionicons
                                                name={isPrimary ? "star" : "star-outline"}
                                                size={24}
                                                color={isPrimary ? "#D4AF37" : "#6B7280"}
                                            />
                                        </TouchableOpacity>

                                        {/* Selected Indicator */}
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={24} color="#D4AF37" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
