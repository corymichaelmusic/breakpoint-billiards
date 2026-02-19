const { createClient } = require('@supabase/supabase-js');
const { Expo } = require('expo-server-sdk');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const expo = new Expo();

async function sendTestNotification(userIdOrToken) {
    let pushToken = userIdOrToken;

    // If it looks like a UUID, fetch from Supabase
    if (userIdOrToken.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.log(`Fetching push token for user ID: ${userIdOrToken}`);
        const { data, error } = await supabase
            .from('profiles')
            .select('push_token, full_name')
            .eq('id', userIdOrToken)
            .single();

        if (error || !data || !data.push_token) {
            console.error("Error fetching user or no token found:", error);
            return;
        }
        pushToken = data.push_token;
        console.log(`Found token for ${data.full_name}: ${pushToken}`);
    }

    if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} uses an invalid format`);
        return;
    }

    const messages = [{
        to: pushToken,
        sound: 'default',
        title: 'Test Notification 🎱',
        body: 'This is a test notification from the Breakpoint Billiards script!',
        data: { test: true },
    }];

    try {
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log('Notification sent. Ticket:', ticketChunk);
        }
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

// Ensure expo-server-sdk is installed or provide instructions
const args = process.argv.slice(2);
if (args.length === 0) {
    console.log("Usage: node scripts/test_push_notification.js <USER_ID_OR_TOKEN>");

    // List some users with tokens to be helpful
    (async () => {
        const { data } = await supabase.from('profiles').select('id, full_name, push_token').not('push_token', 'is', null).limit(5);
        if (data && data.length > 0) {
            console.log("\nUsers with tokens:");
            data.forEach(u => console.log(`- ${u.full_name} (${u.id}): ${u.push_token.substring(0, 15)}...`));
        } else {
            console.log("\nNo users found with push tokens yet.");
        }
    })();
} else {
    sendTestNotification(args[0]);
}
