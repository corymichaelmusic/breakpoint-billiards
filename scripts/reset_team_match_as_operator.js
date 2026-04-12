const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const teamMatchId = process.argv[2];

    if (!teamMatchId) {
        throw new Error('Usage: node scripts/reset_team_match_as_operator.js <team_match_id>');
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    try {
        await client.query('BEGIN');

        const operatorResult = await client.query(
            `select l.operator_id
             from team_matches tm
             join leagues l on l.id = tm.league_id
             where tm.id = $1`,
            [teamMatchId]
        );

        const operatorId = operatorResult.rows[0]?.operator_id;
        if (!operatorId) {
            throw new Error(`No operator_id found for team match ${teamMatchId}`);
        }

        await client.query(
            `select set_config('request.jwt.claims', $1, true)`,
            [JSON.stringify({ sub: operatorId, role: 'authenticated' })]
        );

        const submissionResult = await client.query(
            `select id
             from team_match_captain_submissions
             where team_match_id = $1`,
            [teamMatchId]
        );

        const submissionIds = submissionResult.rows.map((row) => row.id);

        const submissionSetResult = submissionIds.length
            ? await client.query(
                `select id
                 from team_match_submission_sets
                 where captain_submission_id = any($1::uuid[])`,
                [submissionIds]
            )
            : { rows: [] };

        const submissionSetIds = submissionSetResult.rows.map((row) => row.id);

        const teamSetResult = await client.query(
            `select id, match_id
             from team_match_sets
             where team_match_id = $1`,
            [teamMatchId]
        );

        const matchIds = teamSetResult.rows
            .map((row) => row.match_id)
            .filter(Boolean);

        if (submissionSetIds.length) {
            await client.query(
                `delete from team_match_submission_games
                 where submission_set_id = any($1::uuid[])`,
                [submissionSetIds]
            );
        }

        if (submissionIds.length) {
            await client.query(
                `delete from team_match_submission_sets
                 where captain_submission_id = any($1::uuid[])`,
                [submissionIds]
            );

            await client.query(
                `delete from team_match_captain_submissions
                 where id = any($1::uuid[])`,
                [submissionIds]
            );
        }

        if (matchIds.length) {
            await client.query(
                `delete from games
                 where match_id = any($1::uuid[])`,
                [matchIds]
            );
        }

        await client.query(
            `delete from team_match_sets
             where team_match_id = $1`,
            [teamMatchId]
        );

        if (matchIds.length) {
            await client.query(
                `delete from matches
                 where id = any($1::uuid[])`,
                [matchIds]
            );
        }

        await client.query(
            `update team_matches
             set status = 'scheduled',
                 put_up_first_team_id = null,
                 wins_a = 0,
                 losses_a = 0,
                 wins_b = 0,
                 losses_b = 0
             where id = $1`,
            [teamMatchId]
        );

        const verificationResult = await client.query(
            `select id, status, put_up_first_team_id, wins_a, losses_a, wins_b, losses_b
             from team_matches
             where id = $1`,
            [teamMatchId]
        );

        const remainingSubmissionResult = await client.query(
            `select count(*)::int as count
             from team_match_captain_submissions
             where team_match_id = $1`,
            [teamMatchId]
        );

        await client.query('COMMIT');

        console.log(JSON.stringify({
            match: verificationResult.rows[0],
            submissionCount: remainingSubmissionResult.rows[0]?.count ?? 0,
        }, null, 2));
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
