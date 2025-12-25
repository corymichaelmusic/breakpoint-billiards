const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getInitStats(playerId, playerName) {
    return {
        playerId, playerName,
        matchesPlayed: 0, matchesWon: 0, matchesLost: 0, totalPoints: 0,
        matchesPlayed_8ball: 0, matchesWon_8ball: 0, matchesLost_8ball: 0,
        matchesPlayed_9ball: 0, matchesWon_9ball: 0, matchesLost_9ball: 0
    };
}

function aggregateMatchStats(stats, match, playerId, games) {
    // Corrected Logic
    stats.matchesPlayed++;
    const isP1 = match.player1_id === playerId;

    // Explicit Points Sum
    const p1Points = (match.points_8ball_p1 || 0) + (match.points_9ball_p1 || 0);
    const p2Points = (match.points_8ball_p2 || 0) + (match.points_9ball_p2 || 0);
    const points = isP1 ? p1Points : p2Points;
    stats.totalPoints += points;
    console.log(`[Match ${match.id}] ID: ${playerId} | Points: ${points} (P1:${p1Points}, P2:${p2Points})`);

    const matchGames = games.filter(g => g.match_id === match.id);
    let has8Ball = false;
    let has9Ball = false;
    let p8_points = 0; let opp8_points = 0;
    let p9_points = 0; let opp9_points = 0;

    matchGames.forEach(g => {
        if (g.winner_id) {
            const isPlayerWinner = g.winner_id === playerId;
            if (g.game_type === '8ball') {
                has8Ball = true;
                if (isPlayerWinner) p8_points++; else opp8_points++;
            } else if (g.game_type === '9ball') {
                has9Ball = true;
                if (isPlayerWinner) p9_points++; else opp9_points++;
            }
        }
    });

    if (has8Ball && (p8_points > 0 || opp8_points > 0)) {
        if (p8_points > opp8_points) stats.matchesWon++;
        else if (p8_points < opp8_points) stats.matchesLost++;
        console.log(`  8-Ball Set: ${p8_points}-${opp8_points} (${p8_points > opp8_points ? 'WIN' : 'LOSS'})`);
    }

    if (has9Ball && (p9_points > 0 || opp9_points > 0)) {
        if (p9_points > opp9_points) stats.matchesWon++;
        else if (p9_points < opp9_points) stats.matchesLost++;
        console.log(`  9-Ball Set: ${p9_points}-${opp9_points} (${p9_points > opp9_points ? 'WIN' : 'LOSS'})`);
    }

    // Check matchesPlayed correction
    stats.matchesPlayed--;
    if (has8Ball && (p8_points > 0 || opp8_points > 0)) stats.matchesPlayed++;
    if (has9Ball && (p9_points > 0 || opp9_points > 0)) stats.matchesPlayed++;
}

async function debugLeaderboard() {
    console.log('Debugging Leaderboard Logic...');
    const { data: sessions } = await supabase.from('leagues').select('id').eq('name', 'Spring 2026').single();
    if (!sessions) { console.log('Session not found'); return; }

    const { data: matches } = await supabase
        .from('matches')
        .select('id, player1_id, player2_id, winner_id, current_points_p1, current_points_p2, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, player1:player1_id(full_name), player2:player2_id(full_name)')
        .eq('league_id', sessions.id)
        .eq('status', 'finalized');

    console.log(`Found ${matches.length} matches.`);

    const matchIds = matches.map(m => m.id);
    const { data: games } = await supabase.from('games').select('*').in('match_id', matchIds);

    const statsMap = new Map();

    matches.forEach(match => {
        // P1
        if (!statsMap.has(match.player1_id)) {
            const name = match.player1 ? match.player1.full_name : 'Unknown';
            statsMap.set(match.player1_id, getInitStats(match.player1_id, name));
        }
        aggregateMatchStats(statsMap.get(match.player1_id), match, match.player1_id, games);

        // P2
        if (!statsMap.has(match.player2_id)) {
            const name = match.player2 ? match.player2.full_name : 'Unknown';
            statsMap.set(match.player2_id, getInitStats(match.player2_id, name));
        }
        aggregateMatchStats(statsMap.get(match.player2_id), match, match.player2_id, games);
    });

    statsMap.forEach(stat => {
        console.log(`Player: ${stat.playerName} | W-L: ${stat.matchesWon}-${stat.matchesLost} | Points: ${stat.totalPoints}`);
    });
}

debugLeaderboard();
