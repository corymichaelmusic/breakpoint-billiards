const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    // 1. Check the match and its submissions
    console.log('\n🔍 Checking recent finalized match...');
    const { rows: matches } = await client.query(`
        SELECT 
            m.id, 
            m.verification_status, 
            m.pending_p1_submission, 
            m.pending_p2_submission,
            p1.full_name as p1_name,
            p2.full_name as p2_name,
            m.player1_id,
            m.player2_id
        FROM matches m
        JOIN profiles p1 ON m.player1_id = p1.id
        JOIN profiles p2 ON m.player2_id = p2.id
        WHERE m.verification_status = 'verified'
        ORDER BY m.p1_submitted_at DESC
        LIMIT 1
    `);

    if (matches.length > 0) {
        const m = matches[0];
        console.log(`Match ID: ${m.id}`);
        console.log(`P1: ${m.p1_name}, P2: ${m.p2_name}`);
        console.log('P1 Submission:', JSON.stringify(m.pending_p1_submission, null, 2));
        console.log('P2 Submission:', JSON.stringify(m.pending_p2_submission, null, 2));
    } else {
        console.log('No recently verified match found.');
    }

    // 2. Check player ratings/stats
    console.log('\n🔍 Checking player ratings...');
    if (matches.length > 0) {
        const { player1_id, player2_id } = matches[0];
        const { rows: players } = await client.query(`
            SELECT 
                p.full_name, 
                p.breakpoint_rating,
                lp.breakpoint_rating as lp_rating,
                lp.breakpoint_confidence,
                lp.matches_played
            FROM profiles p
            JOIN league_players lp ON p.id = lp.player_id
            WHERE p.id IN ($1, $2)
        `, [player1_id, player2_id]);

        console.table(players);
    }

    await client.end();
}

run().catch(console.error);
