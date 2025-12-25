const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SESSION_ID = '41fe1d0e-7ea0-41df-a6ac-efc82ba07481';

async function simulateSession() {
    console.log(`Simulating session: ${SESSION_ID}`);

    // 1. Check if matches exist
    const { count } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', SESSION_ID);

    if (count === 0) {
        console.log("No matches found. Generating schedule...");
        // We need to call the generateSchedule logic, but simpler here.
        // Fetch players
        const { data: players } = await supabase
            .from('league_players')
            .select('player_id')
            .eq('league_id', SESSION_ID);

        if (!players || players.length < 2) {
            console.error("Not enough players to generate schedule.");
            return;
        }

        const playerIds = players.map(p => p.player_id);
        if (playerIds.length % 2 !== 0) playerIds.push('bye');

        const matches = [];
        const n = playerIds.length;
        const rounds = n - 1;
        const totalWeeks = 16;

        for (let week = 1; week <= totalWeeks; week++) {
            const roundIndex = (week - 1) % rounds;
            let currentPlayers = [...playerIds];
            for (let r = 0; r < roundIndex; r++) {
                const last = currentPlayers.pop();
                if (last) currentPlayers.splice(1, 0, last);
            }
            for (let i = 0; i < n / 2; i++) {
                const p1 = currentPlayers[i];
                const p2 = currentPlayers[n - 1 - i];
                if (p1 !== 'bye' && p2 !== 'bye') {
                    matches.push({
                        league_id: SESSION_ID,
                        player1_id: p1,
                        player2_id: p2,
                        week_number: week,
                        status: 'scheduled'
                    });
                }
            }
        }

        const { error } = await supabase.from('matches').insert(matches);
        if (error) console.error("Error inserting matches:", error);
        else console.log(`Generated ${matches.length} matches.`);
    }

    // 2. Fetch all matches
    const { data: allMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('league_id', SESSION_ID);

    if (!allMatches) return;

    console.log(`Found ${allMatches.length} matches. Simulating scores...`);

    // 3. Simulate Scores
    for (const match of allMatches) {
        // Random winner
        const p1Wins = Math.random() > 0.5;
        const winnerId = p1Wins ? match.player1_id : match.player2_id;

        // Random scores (approximate logic)
        const p1Points = p1Wins ? Math.floor(Math.random() * 5) + 10 : Math.floor(Math.random() * 10);
        const p2Points = p1Wins ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * 5) + 10;

        await supabase
            .from('matches')
            .update({
                status: 'finalized',
                winner_id: winnerId,
                points_8ball_p1: Math.floor(p1Points / 2),
                points_8ball_p2: Math.floor(p2Points / 2),
                points_9ball_p1: Math.ceil(p1Points / 2),
                points_9ball_p2: Math.ceil(p2Points / 2),
                current_points_p1: p1Points,
                current_points_p2: p2Points,
                payment_status_p1: 'paid_cash',
                payment_status_p2: 'paid_cash'
            })
            .eq('id', match.id);
    }

    // 4. Ensure Session is Completed
    await supabase
        .from('leagues')
        .update({ status: 'completed' })
        .eq('id', SESSION_ID);

    console.log("Simulation complete!");
}

simulateSession();
