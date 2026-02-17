import { Platform, Alert } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * NOTE: expo-notifications throws an error when imported on Android Expo Go (SDK 53+).
 * We use lazy 'require' inside functions to avoid top-level import crashes.
 */

const isAndroidExpoGo = Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export async function registerForPushNotificationsAsync() {
    if (isAndroidExpoGo) {
        console.warn("[Notification] Notifications are disabled in Android Expo Go (SDK 53+ limitation).");
        return null;
    }

    let token;

    try {
        const Notifications = require('expo-notifications');
        const Device = require('expo-device');

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#D4AF37',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log("[Notification] Permission not granted!");
                Alert.alert("Notification Error", "Permission not granted for push notifications.");
                return null;
            }

            // Get the token that uniquely identifies this device
            // We use the default project ID from app.json/eas.json if available
            // If explicit projectId is needed: 
            // token = (await Notifications.getExpoPushTokenAsync({ projectId: '...' })).data;
            try {
                const tokenData = await Notifications.getExpoPushTokenAsync();
                token = tokenData.data;
                console.log("[Notification] Push Token:", token);
            } catch (tokenError: any) {
                console.error("[Notification] Token Error:", tokenError);
                Alert.alert("Notification Error", "Failed to get token: " + tokenError.message);
                return null;
            }
        } else {
            console.log("[Notification] Must use physical device for Push Notifications");
            Alert.alert("Notification Error", "Must use physical device for Push Notifications.");
        }

        // Configure handler
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });

        // Clear ghosts
        await Notifications.cancelAllScheduledNotificationsAsync();

        return token;
    } catch (e: any) {
        console.warn("[Notification] Error initializing notifications:", e);
        Alert.alert("Notification Error", "Init Error: " + e.message);
        return null;
    }
}

export async function scheduleMatchReminder(match: any, currentUserId?: string) {
    if (!match || !match.scheduled_date) return;

    try {
        const Notifications = require('expo-notifications');
        const { SchedulableTriggerInputTypes } = require('expo-notifications');

        // We only schedule at 8 AM on the day of the match
        const matchDateStr = match.scheduled_date.split('T')[0];
        const [year, month, day] = matchDateStr.split('-').map(Number);

        // Set trigger time to 8:00 AM on the match day
        const trigger = new Date(year, month - 1, day, 8, 0, 0);

        // If 8 AM has already passed today, don't schedule for today
        if (trigger.getTime() <= Date.now()) {
            return;
        }

        const identifier = `match-${match.id}`;

        // Cancel existing notification for this match if any (avoid dupes)
        await Notifications.cancelScheduledNotificationAsync(identifier);

        let opponentName = 'your opponent';
        if (currentUserId) {
            opponentName = match.player1_id === currentUserId
                ? match.player2?.full_name
                : match.player1?.full_name;
        }

        // Fallback names if still empty
        if (!opponentName) opponentName = 'your opponent';

        let timeDisplay = 'scheduled time';
        if (match.scheduled_time) {
            if (match.scheduled_time.includes(':')) {
                const [h, m] = match.scheduled_time.split(':');
                const hour = parseInt(h, 10);
                const suffix = hour >= 12 ? 'PM' : 'AM';
                const hour12 = hour % 12 || 12;
                timeDisplay = `${hour12}:${m} ${suffix}`;
            } else {
                timeDisplay = match.scheduled_time;
            }
        }

        await Notifications.scheduleNotificationAsync({
            identifier,
            content: {
                title: "Match Today! 🎱",
                body: `You play ${opponentName} at ${timeDisplay}. Good luck!`,
                data: { matchId: match.id },
            },
            trigger: {
                type: SchedulableTriggerInputTypes.DATE,
                date: trigger,
            },
        });

        console.log(`[Notification] Scheduled for ${trigger.toLocaleString()}`);
    } catch (e) {
        console.warn("[Notification] Error scheduling notification:", e);
    }
}

export async function cancelMatchReminder(matchId: string) {
    try {
        const Notifications = require('expo-notifications');
        await Notifications.cancelScheduledNotificationAsync(`match-${matchId}`);
    } catch (e) {
        console.warn("[Notification] Error cancelling notification:", e);
    }
}
