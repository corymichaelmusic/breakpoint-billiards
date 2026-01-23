const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function revertLatestMatch() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Find the latest finalized match
        // We look for any match where at least one set is finalized
        const findQuery = `
            SELECT * 
            FROM matches 
            WHERE status_8ball = 'finalized' OR status_9ball = 'finalized'
            ORDER BY submitted_at DESC 
            LIMIT 1;
        `;

        const res = await client.query(findQuery);
        if (res.rows.length === 0) {
            console.log("No finalized matches found.");
            return;
        }

        const match = res.rows[0];
        console.log(`Found Match: ${match.id}`);
        console.log(`Players: ${match.player1_id} vs ${match.player2_id}`);
        console.log(`Submitted At: ${match.submitted_at}`);

        // 2. Prepare Stats to Revert
        const p1 = match.player1_id;
        const p2 = match.player2_id;
        const leagueId = match.league_id;

        // Extract Deltas (Rating Changes)
        const d8_p1 = parseFloat(match.delta_8ball_p1 || 0);
        const d8_p2 = parseFloat(match.delta_8ball_p2 || 0);
        const d9_p1 = parseFloat(match.delta_9ball_p1 || 0);
        const d9_p2 = parseFloat(match.delta_9ball_p2 || 0);

        const totalDeltaP1 = d8_p1 + d9_p1;
        const totalDeltaP2 = d8_p2 + d9_p2;

        // Extract Racks Won/Lost
        // Note: score_8ball_p1 is the raw racks won. 
        // We need to be careful: did the user play 8ball, 9ball, or both?
        // The 'status' flags tell us.

        let p1_racks_won = 0;
        let p1_racks_lost = 0;
        let p2_racks_won = 0;
        let p2_racks_lost = 0;

        let p1_matches_won = 0;
        let p1_matches_lost = 0;
        let p2_matches_won = 0;
        let p2_matches_lost = 0;

        let p1_shutouts = 0;
        let p2_shutouts = 0;

        const is8BallFinalized = match.status_8ball === 'finalized';
        const is9BallFinalized = match.status_9ball === 'finalized';
        const winner8 = match.winner_id_8ball;
        const winner9 = match.winner_id_9ball;

        // Check for Shutout (Same winner in both)
        let isShutout = false;
        let shutoutWinner = null;
        if (is8BallFinalized && is9BallFinalized && winner8 === winner9 && winner8 !== null) {
            isShutout = true;
            shutoutWinner = winner8;
        }

        // 8-Ball Stats
        if (is8BallFinalized) {
            p1_racks_won += match.score_8ball_p1;
            p1_racks_lost += match.score_8ball_p2;
            p2_racks_won += match.score_8ball_p2;
            p2_racks_lost += match.score_8ball_p1;

            if (winner8 === p1) { p1_matches_won++; p2_matches_lost++; }
            if (winner8 === p2) { p2_matches_won++; p1_matches_lost++; }
        }

        // 9-Ball Stats
        if (is9BallFinalized) {
            p1_racks_won += match.score_9ball_p1;
            p1_racks_lost += match.score_9ball_p2;
            p2_racks_won += match.score_9ball_p2;
            p2_racks_lost += match.score_9ball_p1;

            if (winner9 === p1) { p1_matches_won++; p2_matches_lost++; }
            if (winner9 === p2) { p2_matches_won++; p1_matches_lost++; }
        }

        if (isShutout) {
            if (shutoutWinner === p1) p1_shutouts = 1;
            if (shutoutWinner === p2) p2_shutouts = 1;
        }

        console.log(`Reverting P1 (${p1}): Rating -${totalDeltaP1}, Racks -${p1_racks_won}/${p1_racks_lost}`);
        console.log(`Reverting P2 (${p2}): Rating -${totalDeltaP2}, Racks -${p2_racks_won}/${p2_racks_lost}`);

        // 3. Update League Players
        const revertP1Query = `
            UPDATE league_players
            SET 
                breakpoint_rating = breakpoint_rating - $1,
                breakpoint_racks_won = breakpoint_racks_won - $2,
                breakpoint_racks_lost = breakpoint_racks_lost - $3,
                breakpoint_racks_played = breakpoint_racks_played - $4,
                matches_won = matches_won - $5,
                matches_lost = matches_lost - $6,
                matches_played = matches_played - $7,
                shutouts = shutouts - $8,
                
                -- Granular (Simplify: assuming Booleans used in match table map to 1)
                -- Actually, match table has booleans: p1_break_run_8ball etc. 
                -- Wait, the match table stores booleans like 'p1_break_run_8ball'.
                -- We need to check those to decrement the counters properly.
                
                total_break_and_runs_8ball = total_break_and_runs_8ball - (CASE WHEN $9 THEN 1 ELSE 0 END),
                total_break_and_runs_9ball = total_break_and_runs_9ball - (CASE WHEN $10 THEN 1 ELSE 0 END),
                total_rack_and_runs_8ball = total_rack_and_runs_8ball - (CASE WHEN $11 THEN 1 ELSE 0 END),
                total_rack_and_runs_9ball = total_rack_and_runs_9ball - (CASE WHEN $12 THEN 1 ELSE 0 END),

                total_break_and_runs = total_break_and_runs - ((CASE WHEN $9 THEN 1 ELSE 0 END) + (CASE WHEN $10 THEN 1 ELSE 0 END)),
                total_rack_and_runs = total_rack_and_runs - ((CASE WHEN $11 THEN 1 ELSE 0 END) + (CASE WHEN $12 THEN 1 ELSE 0 END)),
                
                total_nine_on_snap = total_nine_on_snap - (CASE WHEN $13 THEN 1 ELSE 0 END)
            WHERE player_id = $14 AND league_id = $15;
        `;

        // Params for P1
        await client.query(revertP1Query, [
            totalDeltaP1, // 1
            p1_racks_won, // 2
            p1_racks_lost, // 3
            (p1_racks_won + p1_racks_lost), // 4
            p1_matches_won, // 5
            p1_matches_lost, // 6
            (p1_matches_won + p1_matches_lost), // 7
            p1_shutouts, // 8
            match.p1_break_run_8ball, // 9
            match.p1_break_run_9ball, // 10
            match.p1_rack_run_8ball, // 11
            false, // 12 (9ball rack run not tracked in match col directly? check schema. usually no)
            match.p1_nine_on_snap, // 13
            p1, // 14
            leagueId // 15
        ]);

        // Params for P2
        const revertP2Query = `
            UPDATE league_players
            SET 
                breakpoint_rating = breakpoint_rating - $1,
                breakpoint_racks_won = breakpoint_racks_won - $2,
                breakpoint_racks_lost = breakpoint_racks_lost - $3,
                breakpoint_racks_played = breakpoint_racks_played - $4,
                matches_won = matches_won - $5,
                matches_lost = matches_lost - $6,
                matches_played = matches_played - $7,
                shutouts = shutouts - $8,
                
                total_break_and_runs_8ball = total_break_and_runs_8ball - (CASE WHEN $9 THEN 1 ELSE 0 END),
                total_break_and_runs_9ball = total_break_and_runs_9ball - (CASE WHEN $10 THEN 1 ELSE 0 END),
                total_rack_and_runs_8ball = total_rack_and_runs_8ball - (CASE WHEN $11 THEN 1 ELSE 0 END),
                total_rack_and_runs_9ball = total_rack_and_runs_9ball - (CASE WHEN $12 THEN 1 ELSE 0 END),

                total_break_and_runs = total_break_and_runs - ((CASE WHEN $9 THEN 1 ELSE 0 END) + (CASE WHEN $10 THEN 1 ELSE 0 END)),
                total_rack_and_runs = total_rack_and_runs - ((CASE WHEN $11 THEN 1 ELSE 0 END) + (CASE WHEN $12 THEN 1 ELSE 0 END)),
                
                total_nine_on_snap = total_nine_on_snap - (CASE WHEN $13 THEN 1 ELSE 0 END)
            WHERE player_id = $14 AND league_id = $15;
        `;

        await client.query(revertP2Query, [
            totalDeltaP2,
            p2_racks_won,
            p2_racks_lost,
            (p2_racks_won + p2_racks_lost),
            p2_matches_won,
            p2_matches_lost,
            (p2_matches_won + p2_matches_lost),
            p2_shutouts,
            match.p2_break_run_8ball,
            match.p2_break_run_9ball,
            match.p2_rack_run_8ball,
            false,
            match.p2_nine_on_snap,
            p2,
            leagueId
        ]);

        // 4. Update Global Profiles
        await client.query('UPDATE profiles SET breakpoint_rating = breakpoint_rating - $1 WHERE id = $2', [totalDeltaP1, p1]);
        await client.query('UPDATE profiles SET breakpoint_rating = breakpoint_rating - $1 WHERE id = $2', [totalDeltaP2, p2]);

        // 5. Reset Match
        const resetMatchQuery = `
            UPDATE matches
            SET 
                status_8ball = 'scheduled',
                status_9ball = 'scheduled',
                winner_id_8ball = NULL,
                winner_id_9ball = NULL,
                points_8ball_p1 = 0, points_8ball_p2 = 0,
                points_9ball_p1 = 0, points_9ball_p2 = 0,
                score_8ball_p1 = 0, score_8ball_p2 = 0,
                score_9ball_p1 = 0, score_9ball_p2 = 0,
                delta_8ball_p1 = NULL, delta_8ball_p2 = NULL,
                delta_9ball_p1 = NULL, delta_9ball_p2 = NULL,
                p1_break_run_8ball = false, p2_break_run_8ball = false,
                p1_rack_run_8ball = false, p2_rack_run_8ball = false,
                p1_break_run_9ball = false, p2_break_run_9ball = false,
                p1_nine_on_snap = false, p2_nine_on_snap = false,
                submitted_at = NULL,
                verification_status = 'in_progress'
            WHERE id = $1;
        `;
        await client.query(resetMatchQuery, [match.id]);

        // 6. Delete Games
        await client.query('DELETE FROM games WHERE match_id = $1', [match.id]);

        console.log("Success! Match and stats reverted.");

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

revertLatestMatch();
