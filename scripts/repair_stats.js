const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config();
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function repairPlayer(client, playerId) {
    console.log(`Reparing stats for player ${playerId}...`);

    // 1. Calculate Racks Played (Total games in matches involving this player)
    const racksPlayedRes = await client.query(`
        SELECT count(*) 
        FROM games g
        JOIN matches m ON g.match_id = m.id
        WHERE m.player1_id = $1 OR m.player2_id = $1
    `, [playerId]);
    const racksPlayed = parseInt(racksPlayedRes.rows[0].count);

    // 2. Calculate Racks Won (Games won by this player)
    const racksWonRes = await client.query(`
        SELECT count(*) FROM games WHERE winner_id = $1
    `, [playerId]);
    const racksWon = parseInt(racksWonRes.rows[0].count);

    // 3. Calculate Racks Lost (Games lost = Total - Won)
    // Note: This assumes every game involves the player if they are in the match.
    // In a 1v1 league, this is true.
    const racksLost = racksPlayed - racksWon;

    // 4. Calculate Granular Stats
    const statsRes = await client.query(`
        SELECT 
            count(*) FILTER (WHERE is_break_and_run) as break_runs,
            count(*) FILTER (WHERE is_rack_and_run) as rack_runs,
            count(*) FILTER (WHERE is_9_on_snap) as snaps,
            count(*) FILTER (WHERE is_early_8) as early8
        FROM games 
        WHERE winner_id = $1
    `, [playerId]);
    const stats = statsRes.rows[0];

    console.log(`Calculated -> Played: ${racksPlayed}, Won: ${racksWon}, Lost: ${racksLost}, BR: ${stats.break_runs}`);

    // 5. UPDATE
    await client.query(`
        UPDATE league_players
        SET 
            breakpoint_racks_played = $2,
            breakpoint_racks_won = $3,
            breakpoint_racks_lost = $4,
            total_break_and_runs = $5,
            total_rack_and_runs = $6,
            total_nine_on_snap = $7,
            total_early_8 = $8
        WHERE player_id = $1
    `, [
        playerId,
        racksPlayed,
        racksWon,
        racksLost,
        stats.break_runs,
        stats.rack_runs,
        stats.snaps,
        stats.early8
    ]);
}

async function run() {
    const client = await pool.connect();
    try {
        // Specific players from the latest debug output
        const players = [
            'user_38V0g7fCDSUhqvq7RiwpoDkI6W0',
            'user_38GKAWlAxWgwMuoirhNpUxHRwWM'
        ];

        for (const pid of players) {
            await repairPlayer(client, pid);
        }
        console.log("Repair complete.");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
