const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("Finding a match...");
        // Reuse same potential match query logic
        const res = await client.query(`
            SELECT id, player1_id, player2_id, league_id 
            FROM matches 
            WHERE status != 'finalized' 
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log("No non-finalized matches found.");
            return;
        }

        const match = res.rows[0];
        console.log("Found match:", match);

        console.log("Calling finalize_match_stats_v2...");

        const args = [
            match.id,          // p_match_id
            '8ball',           // p_game_type
            match.player1_id,  // p_winner_id
            1,                 // p_p1_racks_won
            0,                 // p_p1_racks_lost
            0,                 // p_p2_racks_won
            1,                 // p_p2_racks_lost
            0, 0, 0, 0,        // p1 granular (break, rack, snaps, early)
            0, 0, 0, 0         // p2 granular
        ];

        console.log("Arguments:", args);

        const query = `
            SELECT finalize_match_stats_v2(
                $1, $2, $3, 
                $4, $5, $6, $7, 
                $8, $9, $10, $11, 
                $12, $13, $14, $15
            );
        `;

        await client.query(query, args);
        console.log("✅ RPC V2 call successful!");

    } catch (err) {
        console.error("❌ RPC V2 Call Failed:", err);
    } finally {
        await client.end();
    }
}

run();
