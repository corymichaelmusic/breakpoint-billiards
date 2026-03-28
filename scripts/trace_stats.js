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
        matchesPlayed_8ball: 0,
        matchesWon_8ball: 0,
        matchesLost_8ball: 0,
        matchesPlayed_9ball: 0,
        matchesWon_9ball: 0,
        matchesLost_9ball: 0,
    };
}

function aggregateMatchStats(stats, match, playerId, games = []) {
    stats.matchesPlayed++;
    const isP1 = match.player1_id === playerId;
    const matchGames = games.filter(g => g.match_id === match.id);

    let has8Ball = false;
    let has9Ball = false;

    // Check 8B
    const p1_8 = Number(match.points_8ball_p1) || 0;
    const p2_8 = Number(match.points_8ball_p2) || 0;
    const status8 = match.status_8ball;
    if (status8 === 'finalized' || match.is_forfeit || p1_8 > 0 || p2_8 > 0 || match.winner_id_8ball || match.winner_id) {
        has8Ball = true;
    }

    // Check 9B
    const p1_9 = Number(match.points_9ball_p1) || 0;
    const p2_9 = Number(match.points_9ball_p2) || 0;
    const status9 = match.status_9ball;
    if (status9 === 'finalized' || match.is_forfeit || p1_9 > 0 || p2_9 > 0 || match.winner_id_9ball || match.winner_id) {
        has9Ball = true;
    }

    if (has8Ball) {
        stats.matchesPlayed_8ball++;
        let isWin = false;
        let isLoss = false;

        if (match.winner_id_8ball === playerId) isWin = true;
        else if (match.winner_id_8ball && match.winner_id_8ball !== playerId) isLoss = true;
        else if (match.winner_id === playerId) isWin = true;
        else if (match.winner_id && match.winner_id !== playerId) isLoss = true;
        else {
            const myPoints8 = isP1 ? p1_8 : p2_8;
            const oppPoints8 = isP1 ? p2_8 : p1_8;
            if (myPoints8 > oppPoints8) isWin = true;
            else if (myPoints8 < oppPoints8) isLoss = true;
        }

        if (isWin) {
            stats.matchesWon++;
            stats.matchesWon_8ball++;
        } else if (isLoss) {
            stats.matchesLost++;
            stats.matchesLost_8ball++;
        }
    }

    if (has9Ball) {
        stats.matchesPlayed_9ball++;
        let isWin = false;
        let isLoss = false;

        if (match.winner_id_9ball === playerId) isWin = true;
        else if (match.winner_id_9ball && match.winner_id_9ball !== playerId) isLoss = true;
        else if (match.winner_id === playerId) isWin = true;
        else if (match.winner_id && match.winner_id !== playerId) isLoss = true;
        else {
            const myPoints9 = isP1 ? p1_9 : p2_9;
            const oppPoints9 = isP1 ? p2_9 : p1_9;
            if (myPoints9 > oppPoints9) isWin = true;
            else if (myPoints9 < oppPoints9) isLoss = true;
        }

        if (isWin) {
            stats.matchesWon++;
            stats.matchesWon_9ball++;
        } else if (isLoss) {
            stats.matchesLost++;
            stats.matchesLost_9ball++;
        }
    }

    stats.matchesPlayed--;
    if (has8Ball) stats.matchesPlayed++;
    if (has9Ball) stats.matchesPlayed++;
}

async function run() {
    const { data: matches } = await supabase.from('matches').select('*').eq('league_id', SESSION).or(`player1_id.eq.${BELINDA},player2_id.eq.${BELINDA},player1_id.eq.${CARSON},player2_id.eq.${CARSON}`).order('week_number', { ascending: true });
    
    const belindaStats = getInitStats(BELINDA, 'Belinda');
    const carsonStats = getInitStats(CARSON, 'Carson');

    console.log(`Analyzing ${matches.length} matches...`);

    for (const m of matches) {
        console.log(`\nW${m.week_number} | ID: ${m.id} | Forfeit: ${m.is_forfeit}`);
        console.log(`  Matchup: ${m.player1_id} vs ${m.player2_id}`);
        
        const oldB = { ...belindaStats };
        const oldC = { ...carsonStats };
        
        aggregateMatchStats(belindaStats, m, BELINDA);
        aggregateMatchStats(carsonStats, m, CARSON);
        
        if (m.player1_id === BELINDA || m.player2_id === BELINDA) {
            console.log(`  Belinda change: ${belindaStats.matchesWon - oldB.matchesWon}W, ${belindaStats.matchesLost - oldB.matchesLost}L (Played: ${belindaStats.matchesPlayed - oldB.matchesPlayed})`);
        }
        if (m.player1_id === CARSON || m.player2_id === CARSON) {
            console.log(`  Carson change: ${carsonStats.matchesWon - oldC.matchesWon}W, ${carsonStats.matchesLost - oldC.matchesLost}L (Played: ${carsonStats.matchesPlayed - oldC.matchesPlayed})`);
        }
    }

    console.log('\nFINAL RESULTS (Calculated):');
    console.log(`Belinda: ${belindaStats.matchesWon}-${belindaStats.matchesLost} | Played: ${belindaStats.matchesPlayed}`);
    console.log(`Carson: ${carsonStats.matchesWon}-${carsonStats.matchesLost} | Played: ${carsonStats.matchesPlayed}`);
}

run();
