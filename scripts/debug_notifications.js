
const { createClient } = require('@supabase/supabase-js');
// fetch is global in Node 18+

// Load env vars
// Note: We need the SERVICE_ROLE_KEY to bypass RLS if needed, or at least ANON key if readable.
// Assuming script is run with access to .env or strings are replaced.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://mnjwnpfstbdxcurfijgd.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
    console.error("Error: EXPO_PUBLIC_SUPABASE_ANON_KEY is not set.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    console.log("Searching for users...");

    // 1. Fetch users
    const { data: users, error } = await supabase
        .from('profiles')
        .select('full_name, push_token')
        .in('full_name', ['Cory Hinkley', 'Faithe Newcomb']);

    if (error) {
        console.error("Database Error:", error);
        return;
    }

    if (!users || users.length === 0) {
        console.log("No users found.");
        return;
    }

    console.log("Found Users:", users);

    // 2. Test Push
    const messages = users
        .filter(u => u.push_token)
        .map(u => ({
            to: u.push_token,
            sound: 'default',
            title: 'Debug Test',
            body: `Test notification for ${u.full_name}`,
        }));

    if (messages.length === 0) {
        console.log("No tokens to test.");
        return;
    }

    console.log("Sending Push Messages via Expo...");

    // Using fetch directly to see raw response
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log("Expo API Response:", JSON.stringify(result, null, 2));

    if (result.data) {
        result.data.forEach((ticket, index) => {
            if (ticket.status === 'error') {
                console.error(`Error for ${users[index].full_name}: ${ticket.message} (${ticket.details?.error})`);
            } else {
                console.log(`Success for ${users[index].full_name}: Ticket ID ${ticket.id}`);
            }
        });
    }
}

run();
