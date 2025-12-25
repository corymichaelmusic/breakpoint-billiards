
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;
const matchId = '7b673b8d-415d-4760-995c-705bd51531c1';

async function fullReset() {
    console.log(`FULL RESET for match ${matchId}...`);
    if (!dbUrl) {
        console.error("DATABASE_URL not found.");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();

        // 1. Delete associated games and scorecard entries
        await client.query(`DELETE FROM games WHERE match_id = $1`, [matchId]);
        await client.query(`DELETE FROM scorecard_entries WHERE match_id = $1`, [matchId]);
        console.log("Cleared games and scorecards.");

        // 2. Reset match attributes
        await client.query(`
            UPDATE matches 
            SET 
                status = 'scheduled',
                status_8ball = 'scheduled',
                status_9ball = 'scheduled',
                
                points_8ball_p1 = 0,
                points_8ball_p2 = 0,
                points_9ball_p1 = 0,
                points_9ball_p2 = 0,
                
                winner_id = NULL,
                winner_id_8ball = NULL,
                winner_id_9ball = NULL,
                
                p1_verified = false,
                p2_verified = false,
                
                coin_flip_winner_id = NULL,
                coin_flip_winner_id_9ball = NULL,
                
                current_turn_id = NULL,
                current_state = NULL
                
            WHERE id = $1
        `, [matchId]);

        console.log("Match fully reset to scheduled state.");

        // Notify PostgREST
        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log('Schema reload notified.');

    } catch (e) {
        console.error("Reset Error:", e);
    } finally {
        await client.end();
    }
}

fullReset();
