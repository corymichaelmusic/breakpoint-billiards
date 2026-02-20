import { Platform, Alert, Linking } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * NOTE: expo-notifications throws an error when imported on Android Expo Go (SDK 53+).
 * We use lazy 'require' inside functions to avoid top-level import crashes.
 */

const isAndroidExpoGo = Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let _registering = false;

export async function registerForPushNotificationsAsync() {
    // Prevent concurrent calls (useEffect can fire multiple times)
    if (_registering) {
        console.log("[Notification] Registration already in progress, skipping.");
        return null;
    }
    _registering = true;
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
            const existingPerms = await Notifications.getPermissionsAsync();
            console.log("[Notification] Existing permissions:", JSON.stringify(existingPerms));
            let finalStatus = existingPerms.status;

            if (finalStatus !== 'granted') {
                const requestedPerms = await Notifications.requestPermissionsAsync({
                    ios: {
                        allowAlert: true,
                        allowBadge: true,
                        allowSound: true,
                    },
                    android: {} // Request default permissions based on manifest
                });
                console.log("[Notification] Requested permissions:", JSON.stringify(requestedPerms));
                finalStatus = requestedPerms.status;
            }

            if (finalStatus !== 'granted') {
                console.warn("[Notification] Permission not granted. Final status:", finalStatus);
                // iOS won't re-show the prompt once denied — direct user to Settings
                // Alert user if permissions are denied on either platform
                if (Platform.OS === 'ios' || Platform.OS === 'android') {
                    Alert.alert(
                        "Enable Notifications",
                        "Notifications are disabled. Please enable them in Settings to receive match reminders.",
                        [
                            { text: "Not Now", style: "cancel" },
                            { text: "Open Settings", onPress: () => Linking.openSettings() },
                        ]
                    );
                }
                _registering = false;
                return null;
            }

            // Get the token that uniquely identifies this device
            try {
                const projectId = Constants.expoConfig?.extra?.eas?.projectId;
                console.log("[Notification] Using projectId:", projectId);
                const tokenData = await Notifications.getExpoPushTokenAsync({
                    projectId: projectId || '3966e8df-bb98-4bf1-8f2e-ea5310944899',
                });
                token = tokenData.data;
                console.log("[Notification] Push Token:", token);
            } catch (tokenError: any) {
                console.error("[Notification] Token Error:", tokenError);
                Alert.alert("Push Token Error", `Failed to get push token: ${tokenError.message}`);
                _registering = false;
                return null;
            }
        } else {
            console.log("[Notification] Must use physical device for Push Notifications");
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

        _registering = false;
        return token;
    } catch (e: any) {
        console.warn("[Notification] Error initializing notifications:", e);
        _registering = false;
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
