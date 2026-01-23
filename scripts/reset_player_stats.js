/**
 * Reset stats for Cory and Faithe
 */

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function run() {
    console.log('🔗 Connecting to database...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    // Find Cory and Faithe
    console.log('\n📋 Finding players...');
    const { rows: players } = await client.query(`
        SELECT id, full_name, email, breakpoint_rating 
        FROM profiles 
        WHERE full_name ILIKE '%cory%' OR full_name ILIKE '%faithe%' OR email ILIKE '%cory%'
        ORDER BY full_name
    `);

    console.log('Found players:');
    players.forEach(p => console.log(`  - ${p.full_name} (${p.id}) - Rating: ${p.breakpoint_rating}`));

    if (players.length === 0) {
        console.log('❌ No players found');
        await client.end();
        return;
    }

    const playerIds = players.map(p => p.id);

    // Reset profile stats (just breakpoint_rating)
    console.log('\n🔄 Resetting profile breakpoint ratings...');
    await client.query(`
        UPDATE profiles 
        SET breakpoint_rating = 500
        WHERE id = ANY($1)
    `, [playerIds]);
    console.log('✅ Profile ratings reset');

    // Reset league_players stats (using correct column names)
    console.log('\n🔄 Resetting league_players stats...');
    await client.query(`
        UPDATE league_players 
        SET breakpoint_rating = 500,
            breakpoint_racks_played = 0,
            matches_played = 0,
            matches_won = 0,
            matches_lost = 0,
            breakpoint_racks_won = 0,
            breakpoint_racks_lost = 0,
            total_break_and_runs = 0,
            total_rack_and_runs = 0,
            total_nine_on_snap = 0,
            total_early_8 = 0,
            total_break_and_runs_8ball = 0,
            total_break_and_runs_9ball = 0,
            total_rack_and_runs_8ball = 0,
            total_rack_and_runs_9ball = 0,
            shutouts = 0
        WHERE player_id = ANY($1)
    `, [playerIds]);
    console.log('✅ League player stats reset');

    // Delete their games
    console.log('\n🔄 Deleting games for these players...');
    const { rowCount: gamesDeleted } = await client.query(`
        DELETE FROM games 
        WHERE match_id IN (
            SELECT id FROM matches WHERE player1_id = ANY($1) OR player2_id = ANY($1)
        )
    `, [playerIds]);
    console.log(`✅ Deleted ${gamesDeleted} games`);

    // Reset their matches
    console.log('\n🔄 Resetting matches involving these players...');
    await client.query(`
        UPDATE matches 
        SET status = 'scheduled',
            status_8ball = 'pending',
            status_9ball = 'pending',
            points_8ball_p1 = 0,
            points_8ball_p2 = 0,
            points_9ball_p1 = 0,
            points_9ball_p2 = 0,
            winner_id_8ball = NULL,
            winner_id_9ball = NULL,
            verification_status = 'in_progress',
            pending_p1_submission = NULL,
            pending_p2_submission = NULL,
            p1_submitted_at = NULL,
            p2_submitted_at = NULL,
            auto_submit_deadline = NULL
        WHERE player1_id = ANY($1) OR player2_id = ANY($1)
    `, [playerIds]);
    console.log('✅ Matches reset');

    // Verify
    console.log('\n📊 Verification:');
    const { rows: updated } = await client.query(`
        SELECT p.full_name, p.breakpoint_rating, lp.matches_played, lp.breakpoint_racks_won, lp.total_break_and_runs
        FROM profiles p
        LEFT JOIN league_players lp ON p.id = lp.player_id
        WHERE p.id = ANY($1)
    `, [playerIds]);
    updated.forEach(p => console.log(`  - ${p.full_name}: Rating=${p.breakpoint_rating}, Matches=${p.matches_played || 0}, Racks=${p.breakpoint_racks_won || 0}, BRs=${p.total_break_and_runs || 0}`));

    await client.end();
    console.log('\n✅ Done!');
}

run().catch(e => console.error('❌ Error:', e.message));
