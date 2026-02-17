
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function applyFix() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Note: The finalize_match_stats function was already updated in the previous run of this script.
        // But for completeness and safety, we can re-apply it if we want, or just skip.
        // Let's re-apply it to be sure.
        const funcSql = fs.readFileSync(path.join(__dirname, '../supabase/finalize_match_stats.sql'), 'utf8');
        await client.query(funcSql);
        console.log('Ensure finalize_match_stats function is updated');

        // Fix for Trevor vs Carson (Match 1) - Re-applying just in case
        const match1Id = '5428b1ba-439a-414c-b3bb-e45e272faed2';
        const trevorId = 'user_39GS3UMc77JWeMi3rQ5huSNixqt';

        await client.query(`
            UPDATE matches 
            SET 
                winner_id_8ball = $1,
                score_8ball_p1 = 4,
                score_8ball_p2 = 4,
                points_8ball_p1 = 4,
                points_8ball_p2 = 4,
                status_8ball = 'finalized'
            WHERE id = $2
        `, [trevorId, match1Id]);
        console.log('Trevor vs Carson match verified/updated.');

        // Fix for Glenn vs Belinda (Match 2)
        const match2Id = 'a1064e0e-f02e-4fa1-901e-ce25428df36a';
        const belindaId = 'user_39XlZlqfHAB3neYHj8wlKnyEj2W';

        console.log('Fixing Glenn vs Belinda match winner...');
        await client.query(`
            UPDATE matches 
            SET 
                winner_id_8ball = $1,
                score_8ball_p1 = 5,
                score_8ball_p2 = 4,
                points_8ball_p1 = 5,
                points_8ball_p2 = 4,
                status_8ball = 'finalized'
            WHERE id = $2
        `, [belindaId, match2Id]);
        console.log('Glenn vs Belinda match successfully updated.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

applyFix();
