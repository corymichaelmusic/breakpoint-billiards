const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const teamMatchId = process.argv[2];

    if (!teamMatchId) {
        throw new Error('Usage: node scripts/reset_team_match.js <team_match_id> [--execute]');
    }

    const execute = process.argv.includes('--execute');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    try {
        await client.query('BEGIN');

        const { rows: teamMatchRows } = await client.query(
            `select id, league_id, team_a_id, team_b_id, week_number, status, put_up_first_team_id, wins_a, losses_a, wins_b, losses_b
             from team_matches
             where id = $1`,
            [teamMatchId]
        );

        if (teamMatchRows.length === 0) {
            throw new Error(`Team match not found: ${teamMatchId}`);
        }

        const { rows: teamSetRows } = await client.query(
            `select id, set_number, game_type, match_id, winner_team_id
             from team_match_sets
             where team_match_id = $1
             order by set_number`,
            [teamMatchId]
        );

        const { rows: submissionRows } = await client.query(
            `select id, team_id, verification_status, put_up_first_team_id, submitted_for_verification_at, verified_at
             from team_match_captain_submissions
             where team_match_id = $1
             order by created_at`,
            [teamMatchId]
        );

        const submissionIds = submissionRows.map((row) => row.id);
        const { rows: submissionSetRows } = submissionIds.length
            ? await client.query(
                `select id, captain_submission_id, set_number, game_type, race_p1, race_p2, status
                 from team_match_submission_sets
                 where captain_submission_id = any($1::uuid[])
                 order by captain_submission_id, set_number`,
                [submissionIds]
            )
            : { rows: [] };

        const submissionSetIds = submissionSetRows.map((row) => row.id);
        const { rows: submissionGameRows } = submissionSetIds.length
            ? await client.query(
                `select id, submission_set_id, game_number, winner_id
                 from team_match_submission_games
                 where submission_set_id = any($1::uuid[])
                 order by submission_set_id, game_number`,
                [submissionSetIds]
            )
            : { rows: [] };

        const matchIds = teamSetRows.map((row) => row.match_id).filter(Boolean);
        const { rows: generatedMatchRows } = matchIds.length
            ? await client.query(
                `select id, status, player1_id, player2_id, is_team_match_set
                 from matches
                 where id = any($1::uuid[])
                 order by id`,
                [matchIds]
            )
            : { rows: [] };

        const { rows: generatedGameRows } = matchIds.length
            ? await client.query(
                `select id, match_id, game_number, winner_id
                 from games
                 where match_id = any($1::uuid[])
                 order by match_id, game_number`,
                [matchIds]
            )
            : { rows: [] };

        const summary = {
            team_match: teamMatchRows[0],
            counts: {
                team_match_sets: teamSetRows.length,
                captain_submissions: submissionRows.length,
                submission_sets: submissionSetRows.length,
                submission_games: submissionGameRows.length,
                generated_matches: generatedMatchRows.length,
                generated_games: generatedGameRows.length,
            },
            team_match_sets: teamSetRows,
            captain_submissions: submissionRows,
            generated_matches: generatedMatchRows,
        };

        if (execute) {
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

                await client.query(
                    `delete from team_match_sets
                     where team_match_id = $1`,
                    [teamMatchId]
                );

                await client.query(
                    `delete from matches
                     where id = any($1::uuid[])`,
                    [matchIds]
                );
            } else {
                await client.query(
                    `delete from team_match_sets
                     where team_match_id = $1`,
                    [teamMatchId]
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
        }

        if (execute) {
            await client.query('COMMIT');
        } else {
            await client.query('ROLLBACK');
        }

        console.log(JSON.stringify({ execute, summary }, null, 2));
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
