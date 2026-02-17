'use server';

import { createAdminClient } from "@/utils/supabase/admin";
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { verifyOperator } from "@/utils/auth-helpers";
import { auth } from "@clerk/nextjs/server";

const expo = new Expo();

export async function sendSessionNotification(sessionId: string, title: string, body: string) {
    try {
        // 1. Verify permissions (Operator of this session)
        await verifyOperator(sessionId);

        const supabase = createAdminClient();

        // 2. Fetch all active players in the session
        // We select profiles of active players in this league/session
        const { data: players, error } = await supabase
            .from('league_players')
            .select(`
                player_id,
                profiles!inner(
                    id,
                    full_name,
                    push_token,
                    is_active
                )
            `)
            .eq('league_id', sessionId)
            .eq('status', 'active')
            .eq('profiles.is_active', true)
            .not('profiles.push_token', 'is', null);

        if (error) {
            console.error("Error fetching session players:", error);
            throw new Error("Failed to fetch players");
        }

        if (!players || players.length === 0) {
            return { success: true, count: 0, message: "No active players with push tokens found." };
        }

        // 3. Prepare messages
        const messages: ExpoPushMessage[] = [];
        const pushTokens = players.map(p => {
            const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
            return profile?.push_token;
        }).filter(t => t && Expo.isExpoPushToken(t));

        // Deduplicate tokens if needed? Users might have same token if shared... unlikely but possible if same device used.
        // Actually unique per user is better.
        const uniqueTokens = Array.from(new Set(pushTokens));

        for (const token of uniqueTokens) {
            if (!token) continue;
            messages.push({
                to: token,
                sound: 'default',
                title: title,
                body: body,
                data: { sessionId },
            });
        }

        if (messages.length === 0) {
            return { success: true, count: 0, message: "No valid push tokens found." };
        }

        // 4. Send notifications in chunks
        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error("Error sending chunk:", error);
            }
        }

        // 5. Log activity (Optional but good)
        console.log(`[Notification] Sent ${messages.length} notifications to session ${sessionId}. Title: ${title}`);

        return { success: true, count: messages.length };

    } catch (error: any) {
        console.error("Send Notification Error:", error);
        return { success: false, error: error.message };
    }
}
