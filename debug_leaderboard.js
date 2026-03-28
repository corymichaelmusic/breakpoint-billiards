const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Ported from stats-calculator.ts and stats-actions.ts
function getInitStats(playerId, playerName) {
    return {
        playerId, playerName, matchesPlayed: 0, matchesWon: 0, matchesLost: 0, totalPoints: 0,
        matchesPlayed_8ball: 0, matchesWon_8ball: 0, matchesLost_8ball: 0,
        matchesPlayed_9ball: 0, matchesWon_9ball: 0, matchesLost_9ball: 0,
        racksWon_8ball: 0, racksPlayed_8ball: 0, racksWon_9ball: 0, racksPlayed_9ball: 0,
        totalRacksPlayed: 0
    };
}

function aggregateMatchStats(stats, match, playerId, games) {
    stats.matchesPlayed++;
    const isP1 = match.player1_id === playerId;
    const p1_8 = Number(match.points_8ball_p1) || 0;
    const p2_8 = Number(match.points_8ball_p2) || 0;
    const p1_9 = Number(match.points_9ball_p1) || 0;
    const p2_9 = Number(match.points_9ball_p2) || 0;
    
    const myPoints = isP1 ? (p1_8 + p1_9) : (p2_8 + p2_9);
    stats.totalPoints += myPoints;

    const matchGames = games.filter(g => g.match_id === match.id);
    let has8Ball = match.status_8ball === 'finalized' || p1_8 > 0 || p2_8 > 0 || match.winner_id_8ball;
    let has9Ball = match.status_9ball === 'finalized' || p1_9 > 0 || p2_9 > 0 || match.winner_id_9ball;

    if (has8Ball) {
        stats.matchesPlayed_8ball++;
        let myRacks = 0, oppRacks = 0;
        matchGames.filter(g => g.game_type === '8ball').forEach(g => {
            if (g.winner_id === playerId) myRacks++; else if (g.winner_id) oppRacks++;
        });
        stats.racksWon_8ball += myRacks;
        stats.racksPlayed_8ball += (myRacks + oppRacks);
        stats.totalRacksPlayed += (myRacks + oppRacks);

        let isWin = match.winner_id_8ball === playerId;
        let isLoss = match.winner_id_8ball && match.winner_id_8ball !== playerId;
        if (!isWin && !isLoss) {
             const m8 = isP1 ? p1_8 : p2_8;
             const o8 = isP1 ? p2_8 : p1_8;
             if (m8 > o8) isWin = true; else if (o8 > m8) isLoss = true;
        }
        if (isWin) { stats.matchesWon++; stats.matchesWon_8ball++; }
        else if (isLoss) { stats.matchesLost++; stats.matchesLost_8ball++; }
    }

    if (has9Ball) {
        stats.matchesPlayed_9ball++;
        let myRacks = 0, oppRacks = 0;
        matchGames.filter(g => g.game_type === '9ball').forEach(g => {
            if (g.winner_id === playerId) myRacks++; else if (g.winner_id) oppRacks++;
        });
        stats.racksWon_9ball += myRacks;
        stats.racksPlayed_9ball += (myRacks + oppRacks);
        stats.totalRacksPlayed += (myRacks + oppRacks);

        let isWin = match.winner_id_9ball === playerId;
        let isLoss = match.winner_id_9ball && match.winner_id_9ball !== playerId;
        if (!isWin && !isLoss) {
             const m9 = isP1 ? p1_9 : p2_9;
             const o9 = isP1 ? p2_9 : p1_9;
             if (m9 > o9) isWin = true; else if (o9 > m9) isLoss = true;
        }
        if (isWin) { stats.matchesWon++; stats.matchesWon_9ball++; }
        else if (isLoss) { stats.matchesLost++; stats.matchesLost_9ball++; }
    }

    stats.matchesPlayed--;
    if (has8Ball) stats.matchesPlayed++;
    if (has9Ball) stats.matchesPlayed++;
}

async function run() {
    const michaelId = 'user_38xbqBHx2bj8x2YO9FF5LwYQgTa';
    const leagueName = 'Spring 2026';
    const { data: league } = await supabase.from('leagues').select('id').ilike('name', '%' + leagueName + '%').single();
    if (!league) return console.log("League not found");

    const { data: matches } = await supabase.from('matches').select('*').eq('league_id', league.id).or(`player1_id.eq.${michaelId},player2_id.eq.${michaelId}`);
    const { data: games } = await supabase.from('games').select('*').in('match_id', matches.map(m => m.id));

    let stats = getInitStats(michaelId, "Michael Moschella");
    console.log("Processing matches for Michael...");
    matches.forEach(m => {
        console.log(`Match ${m.id} (Week ${m.week_number}): 8ball Winner=${m.winner_id_8ball}, Points=${m.points_8ball_p1}-${m.points_8ball_p2}`);
        aggregateMatchStats(stats, m, michaelId, games);
    });

    stats.winRate = stats.matchesPlayed > 0 ? Math.round((stats.matchesWon / stats.matchesPlayed) * 100) : 0;
    console.log("\n--- Calculated Stats for Michael ---");
    console.log(JSON.stringify(stats, null, 2));

    const { data: lp } = await supabase.from('league_players').select('*').eq('player_id', michaelId).eq('league_id', league.id).single();
    console.log("\n--- league_players record ---");
    console.log(JSON.stringify(lp, null, 2));
}
run();
