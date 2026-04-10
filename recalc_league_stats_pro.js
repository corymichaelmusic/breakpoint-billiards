const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getInitStats(playerId, playerName) {
    return {
        playerId, playerName, matchesPlayed: 0, matchesWon: 0, matchesLost: 0,
        matchesPlayed_8ball: 0, matchesWon_8ball: 0, matchesLost_8ball: 0,
        matchesPlayed_9ball: 0, matchesWon_9ball: 0, matchesLost_9ball: 0,
        racksWon_8ball: 0, racksPlayed_8ball: 0, racksWon_9ball: 0, racksPlayed_9ball: 0,
        totalRacksPlayed: 0, shutouts: 0
    };
}

function aggregateMatchStats(stats, match, playerId, games) {
    const isP1 = match.player1_id === playerId;
    const p1_8 = Number(match.points_8ball_p1) || 0;
    const p2_8 = Number(match.points_8ball_p2) || 0;
    const p1_9 = Number(match.points_9ball_p1) || 0;
    const p2_9 = Number(match.points_9ball_p2) || 0;
    
    const matchGames = games.filter(g => g.match_id === match.id);
    let has8Ball = match.status_8ball === 'finalized' || p1_8 > 0 || p2_8 > 0 || match.winner_id_8ball;
    let has9Ball = match.status_9ball === 'finalized' || p1_9 > 0 || p2_9 > 0 || match.winner_id_9ball;

    let p1Win8 = false, p2Win8 = false, p1Win9 = false, p2Win9 = false;

    if (has8Ball) {
        stats.matchesPlayed_8ball++;
        stats.matchesPlayed++;
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
        if (isWin) { stats.matchesWon++; stats.matchesWon_8ball++; if (isP1) p1Win8 = true; else p2Win8 = true; }
        else if (isLoss) { stats.matchesLost++; stats.matchesLost_8ball++; if (isP1) p2Win8 = true; else p1Win8 = true; }
    }

    if (has9Ball) {
        stats.matchesPlayed_9ball++;
        stats.matchesPlayed++;
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
        if (isWin) { stats.matchesWon++; stats.matchesWon_9ball++; if (isP1) p1Win9 = true; else p2Win9 = true; }
        else if (isLoss) { stats.matchesLost++; stats.matchesLost_9ball++; if (isP1) p2Win9 = true; else p1Win9 = true; }
    }

    if (!match.is_forfeit && has8Ball && has9Ball) {
        if (p1Win8 && p1Win9 && isP1) stats.shutouts++;
        if (p2Win8 && p2Win9 && !isP1) stats.shutouts++;
    }
}

async function run() {
    console.log("Starting PRO Stats Recalculation...");
    const { data: matches } = await supabase.from('matches').select('*');
    const { data: games } = await supabase.from('games').select('*');
    const { data: players } = await supabase.from('league_players').select('player_id, league_id');

    console.log(`Processing ${players.length} player records...`);

    for (const p of players) {
        const pMatches = matches.filter(m => m.league_id === p.league_id && (m.player1_id === p.player_id || m.player2_id === p.player_id));
        let stats = getInitStats(p.player_id, "");
        pMatches.forEach(m => aggregateMatchStats(stats, m, p.player_id, games));

        const { error } = await supabase.from('league_players').update({
            matches_played: stats.matchesPlayed,
            matches_won: stats.matchesWon,
            matches_lost: stats.matchesLost,
            breakpoint_racks_won: stats.racksWon_8ball + stats.racksWon_9ball,
            breakpoint_racks_played: stats.totalRacksPlayed,
            shutouts: stats.shutouts
        }).eq('player_id', p.player_id).eq('league_id', p.league_id);

        if (error) console.error("Error updating player:", p.player_id, error);
    }
    console.log("PRO Recalculation Complete.");
}
run();
