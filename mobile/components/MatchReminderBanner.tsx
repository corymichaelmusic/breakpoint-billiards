import { View, Text, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

interface MatchReminderBannerProps {
    nextMatch: any;
    onDismiss: (type: '3day' | 'dayof') => void;
}

export default function MatchReminderBanner({ nextMatch, onDismiss }: MatchReminderBannerProps) {
    const [visible, setVisible] = useState(false);
    const [reminderType, setReminderType] = useState<'3day' | 'dayof' | null>(null);

    useEffect(() => {
        checkVisibility();
    }, [nextMatch]);

    const checkVisibility = async () => {
        if (!nextMatch || !nextMatch.scheduled_date) return;

        const now = new Date();
        // Check if it's past 8 AM
        if (now.getHours() < 8) return;

        const matchDateStr = nextMatch.scheduled_date.split('T')[0];
        const [year, month, day] = matchDateStr.split('-').map(Number);
        const matchMidnight = new Date(year, month - 1, day);
        const today = new Date();
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const diffTime = matchMidnight.getTime() - todayMidnight.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let type: '3day' | 'dayof' | null = null;

        if (diffDays === 0) {
            type = 'dayof';
        }

        if (type) {
            // Check if this type is already dismissed (passed via nextMatch prop from DB)
            const dismissedTypes = nextMatch.dismissed_types || [];

            if (!dismissedTypes.includes(type)) {
                setReminderType(type);
                setVisible(true);
            } else {
                setVisible(false);
            }
        } else {
            setVisible(false);
        }
    };

    const handleDismiss = async () => {
        if (!nextMatch || !reminderType) return;
        setVisible(false); // Optimistic hide
        onDismiss(reminderType);
    };

    if (!visible || !nextMatch || !reminderType) return null;

    const opponentName = nextMatch.player1_id === nextMatch.currentUserId
        ? nextMatch.player2?.full_name
        : nextMatch.player1?.full_name;

    // Handle "Unknown" if opponent is not populated yet
    const displayOpponent = opponentName || 'your opponent';

    const timeDisplay = nextMatch.scheduled_time
        ? (() => {
            if (!nextMatch.scheduled_time.includes(':')) return nextMatch.scheduled_time;
            const [h, m] = nextMatch.scheduled_time.split(':');
            const hour = parseInt(h, 10);
            const suffix = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;
            return `${hour12}:${m} ${suffix}`;
        })()
        : 'Default Time';

    return (
        <View className="bg-[#D4AF37]/10 border-b border-[#D4AF37]/20 px-4 py-3 flex-row items-center justify-between">
            <View className="flex-1 mr-2">
                <Text className="text-[#D4AF37] font-bold text-sm uppercase tracking-wider mb-1">
                    Match Today!
                </Text>
                {(nextMatch.league_name || nextMatch.session_name) && (
                    <Text className="text-gray-400 text-xs font-bold uppercase mb-1" numberOfLines={1} adjustsFontSizeToFit>
                        {[nextMatch.league_name, nextMatch.session_name, nextMatch.location].filter(Boolean).join(' | ')}
                    </Text>
                )}
                <Text className="text-gray-300 text-sm leading-5">
                    You are playing <Text className="text-white font-bold">{displayOpponent}</Text> at <Text className="text-white font-bold">{timeDisplay}</Text>.
                </Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
        </View>
    );
}
