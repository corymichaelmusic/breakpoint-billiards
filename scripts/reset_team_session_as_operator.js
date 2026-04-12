const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const sessionId = process.argv[2];

    if (!sessionId) {
        throw new Error('Usage: node scripts/reset_team_session_as_operator.js <session_id>');
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    try {
        await client.query('BEGIN');

        const leagueResult = await client.query(
            `select id, name, operator_id
             from leagues
             where id = $1`,
            [sessionId]
        );

        const league = leagueResult.rows[0];
        if (!league) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        if (!league.operator_id) {
            throw new Error(`No operator_id found for session ${sessionId}`);
        }

        await client.query(
            `select set_config('request.jwt.claims', $1, true)`,
            [JSON.stringify({ sub: league.operator_id, role: 'authenticated' })]
        );

        const teamMatchResult = await client.query(
            `select id
             from team_matches
             where league_id = $1`,
            [sessionId]
        );
        const teamMatchIds = teamMatchResult.rows.map((row) => row.id);

        const captainSubmissionResult = teamMatchIds.length
            ? await client.query(
                `select id
                 from team_match_captain_submissions
                 where team_match_id = any($1::uuid[])`,
                [teamMatchIds]
            )
            : { rows: [] };
        const captainSubmissionIds = captainSubmissionResult.rows.map((row) => row.id);

        const submissionSetResult = captainSubmissionIds.length
            ? await client.query(
                `select id
                 from team_match_submission_sets
                 where captain_submission_id = any($1::uuid[])`,
                [captainSubmissionIds]
            )
            : { rows: [] };
        const submissionSetIds = submissionSetResult.rows.map((row) => row.id);

        const teamSetResult = teamMatchIds.length
            ? await client.query(
                `select id, match_id
                 from team_match_sets
                 where team_match_id = any($1::uuid[])`,
                [teamMatchIds]
            )
            : { rows: [] };
        const generatedMatchIds = teamSetResult.rows
            .map((row) => row.match_id)
            .filter(Boolean);

        const matchResult = await client.query(
            `select id
             from matches
             where league_id = $1`,
            [sessionId]
        );
        const sessionMatchIds = matchResult.rows.map((row) => row.id);

        const teamResult = await client.query(
            `select id
             from teams
             where league_id = $1`,
            [sessionId]
        );
        const teamIds = teamResult.rows.map((row) => row.id);

        if (sessionMatchIds.length) {
            await client.query(
                `delete from reschedule_requests
                 where match_id = any($1::uuid[])`,
                [sessionMatchIds]
            );
        }

        if (submissionSetIds.length) {
            await client.query(
                `delete from team_match_submission_games
                 where submission_set_id = any($1::uuid[])`,
                [submissionSetIds]
            );
        }

        if (captainSubmissionIds.length) {
            await client.query(
                `delete from team_match_submission_sets
                 where captain_submission_id = any($1::uuid[])`,
                [captainSubmissionIds]
            );

            await client.query(
                `delete from team_match_captain_submissions
                 where id = any($1::uuid[])`,
                [captainSubmissionIds]
            );
        }

        if (generatedMatchIds.length) {
            await client.query(
                `delete from games
                 where match_id = any($1::uuid[])`,
                [generatedMatchIds]
            );
        }

        if (teamMatchIds.length) {
            await client.query(
                `delete from team_match_sets
                 where team_match_id = any($1::uuid[])`,
                [teamMatchIds]
            );

            await client.query(
                `delete from team_matches
                 where id = any($1::uuid[])`,
                [teamMatchIds]
            );
        }

        if (sessionMatchIds.length) {
            await client.query(
                `delete from games
                 where match_id = any($1::uuid[])`,
                [sessionMatchIds]
            );

            await client.query(
                `delete from matches
                 where id = any($1::uuid[])`,
                [sessionMatchIds]
            );
        }

        if (teamIds.length) {
            await client.query(
                `delete from team_members
                 where team_id = any($1::uuid[])`,
                [teamIds]
            );

            await client.query(
                `delete from teams
                 where id = any($1::uuid[])`,
                [teamIds]
            );
        }

        await client.query(
            `delete from league_players
             where league_id = $1`,
            [sessionId]
        );

        await client.query(
            `update leagues
             set status = 'setup',
                 reset_requested = false
             where id = $1`,
            [sessionId]
        );

        const verification = await client.query(
            `select
                (select count(*)::int from league_players where league_id = $1) as league_players,
                (select count(*)::int from matches where league_id = $1) as matches,
                (select count(*)::int from team_matches where league_id = $1) as team_matches,
                (select count(*)::int from teams where league_id = $1) as teams,
                (select status from leagues where id = $1) as status`,
            [sessionId]
        );

        await client.query('COMMIT');

        console.log(JSON.stringify({
            session: {
                id: league.id,
                name: league.name,
            },
            verification: verification.rows[0],
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
