const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.EXPO_PUBLIC_SUPABASE_URL || envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

const BELINDA = 'user_39XlZlqfHAB3neYHj8wlKnyEj2W';
const CARSON = 'user_39ljU8svOLfZpKZKJUvDZYC0vlz';
const SESSION = '2b08d033-f2cd-47cc-b6d8-78544a5df684';

function getInitStats(playerId, playerName) {
    return {
        playerId,
        playerName,
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        totalPoints: 0,
        totalRacksPlayed: 0
    };
}

function aggregateMatchStats(stats, match, playerId) {
    stats.matchesPlayed++;
    const isP1 = match.player1_id === playerId;
    
    let has8Ball = (match.status_8ball === 'finalized' || match.is_forfeit || match.points_8ball_p1 > 0 || match.points_8ball_p2 > 0 || match.winner_id_8ball);
    let has9Ball = (match.status_9ball === 'finalized' || match.is_forfeit || match.points_9ball_p1 > 0 || match.points_9ball_p2 > 0 || match.winner_id_9ball);

    if (has8Ball) {
        let win = (match.winner_id_8ball === playerId) || (match.winner_id === playerId && !match.winner_id_8ball);
        let loss = (match.winner_id_8ball && match.winner_id_8ball !== playerId) || (match.winner_id && match.winner_id !== playerId && !match.winner_id_8ball);
        
        if (win) stats.matchesWon++;
        else if (loss) stats.matchesLost++;
    }

    if (has9Ball) {
        let win = (match.winner_id_9ball === playerId) || (match.winner_id === playerId && !match.winner_id_9ball);
        let loss = (match.winner_id_9ball && match.winner_id_9ball !== playerId) || (match.winner_id && match.winner_id !== playerId && !match.winner_id_9ball);
        
        if (win) stats.matchesWon++;
        else if (loss) stats.matchesLost++;
    }

    stats.matchesPlayed--;
    if (has8Ball) stats.matchesPlayed++;
    if (has9Ball) stats.matchesPlayed++;
}

async function run() {
    const { data: roster } = await supabase.from('league_players').select('player_id, profiles:player_id(full_name)').eq('league_id', SESSION).eq('status', 'active');
    const statsMap = new Map();
    roster.forEach(m => {
        const name = Array.isArray(m.profiles) ? m.profiles[0]?.full_name : m.profiles?.full_name;
        statsMap.set(m.player_id, getInitStats(m.player_id, name || 'Unknown'));
    });

    const { data: matches } = await supabase.from('matches').select('*').eq('league_id', SESSION).order('week_number', { ascending: true });

    matches.forEach(match => {
        if (statsMap.has(match.player1_id)) {
            const stats = statsMap.get(match.player1_id);
            const old = { w: stats.matchesWon, l: stats.matchesLost };
            aggregateMatchStats(stats, match, match.player1_id);
            if (match.player1_id === CARSON || match.player1_id === BELINDA) {
                console.log(`${stats.playerName} W${match.week_number} Update: +${stats.matchesWon - old.w}W, +${stats.matchesLost - old.l}L | Total: ${stats.matchesWon}-${stats.matchesLost} | Match: ${match.id}`);
            }
        }
        if (statsMap.has(match.player2_id)) {
            const stats = statsMap.get(match.player2_id);
            const old = { w: stats.matchesWon, l: stats.matchesLost };
            aggregateMatchStats(stats, match, match.player2_id);
            if (match.player2_id === CARSON || match.player2_id === BELINDA) {
                console.log(`${stats.playerName} W${match.week_number} Update: +${stats.matchesWon - old.w}W, +${stats.matchesLost - old.l}L | Total: ${stats.matchesWon}-${stats.matchesLost} | Match: ${match.id}`);
            }
        }
    });

    const results = Array.from(statsMap.values()).map(s => ({
        name: s.playerName,
        record: `${s.matchesWon}-${s.matchesLost}`,
        played: s.matchesPlayed
    }));

    console.log(JSON.stringify(results, null, 2));
}

run();
