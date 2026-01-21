const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Hardcoded user ID for 'corymichaelmusic@gmail.com' based on context or we can email search
// Or simpler: fetch for a specific email
const TARGET_EMAIL = 'corymichaelmusic@gmail.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditData() {
    console.log("Starting Audit...");

    // 1. Get User ID
    const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('email', TARGET_EMAIL) // Profiles usually doesn't have email in public schema? 
    // If profile doesn't have email, we might need to rely on the fact the user is logged in the request context usually.
    // But for a script... let's try to find by name 'Cory' if email fails or just list recent matches.
    // Actually, let's just fetch all matches for the last 24h and filter log.

    // Using a known ID if possible would be better.
    // Let's assume we can fetch by name for now as fallback

    // Checking recent matches
    const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (matchError) {
        console.error("Match Error:", matchError);
        return;
    }

    console.log("--- Recent Matches (Last 5) ---");
    matches.forEach(m => {
        console.log(`Match ID: ${m.id}`);
        console.log(`  Week: ${m.week_number}`);
        console.log(`  P1: ${m.player1_id} | P2: ${m.player2_id}`);
        console.log(`  8-Ball: ${m.points_8ball_p1}-${m.points_8ball_p2} | Status: ${m.status_8ball} | Winner: ${m.winner_id_8ball}`);
        console.log(`  9-Ball: ${m.points_9ball_p1}-${m.points_9ball_p2} | Status: ${m.status_9ball} | Winner: ${m.winner_id_9ball}`);
        console.log("------------------------------------------------");
    });

}

auditData();
