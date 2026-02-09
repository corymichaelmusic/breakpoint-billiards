const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getEmails() {
    console.log("Searching for 'Spring 2026' session...");

    // 1. Find the League/Session
    const { data: leagues, error: lError } = await supabase
        .from('leagues')
        .select('id, name')
        .ilike('name', '%Spring 2026%');

    if (lError) {
        console.error("Error fetching leagues:", lError);
        return;
    }

    if (!leagues || leagues.length === 0) {
        console.log("No league found matching 'Spring 2026'.");
        return;
    }

    console.log(`Found ${leagues.length} league(s):`);
    leagues.forEach(l => console.log(` - ${l.name} (${l.id})`));

    // For each found league, fetch players
    for (const league of leagues) {
        console.log(`\nFetching emails for: ${league.name}`);

        const { data: participants, error: pError } = await supabase
            .from('league_players')
            .select(`
                player_id,
                profiles:player_id (
                    email,
                    full_name
                )
            `)
            .eq('league_id', league.id);

        if (pError) {
            console.error(`Error fetching players for ${league.name}:`, pError);
            continue;
        }

        const emailList = [];
        participants.forEach(p => {
            const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
            if (profile && profile.email) {
                emailList.push(`${profile.full_name} <${profile.email}>`);
            }
        });

        if (emailList.length === 0) {
            console.log("No emails found for this session.");
        } else {
            console.log(`Found ${emailList.length} emails:`);
            console.log(emailList.join('\n'));

            console.log("\nComma Separated (for pasting):");
            const rawEmails = participants
                .map(p => {
                    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
                    return profile?.email;
                })
                .filter(e => e);
            console.log(rawEmails.join(', '));
        }
    }
}

getEmails();
