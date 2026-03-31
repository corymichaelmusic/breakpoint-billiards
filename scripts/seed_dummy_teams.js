const { Client } = require('pg');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const SESSION_ID = process.argv[2] || '723e9c26-f5fc-4e5a-a705-bbe046dabdd1';

const TEAM_DEFS = [
    {
        name: 'Test Breakers',
        tidPrefix: 'TB',
        ratings: [640, 590, 545, 500, 455, 410],
    },
    {
        name: 'Rack Runners',
        tidPrefix: 'RR',
        ratings: [625, 575, 530, 485, 440, 395],
    },
];

function makePlayerNumber(seed, offset) {
    return Number(`98${String(seed).padStart(4, '0')}${String(offset).padStart(2, '0')}`);
}

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    try {
        const { rows: sessionRows } = await client.query(
            `
                SELECT id, name, type, status, is_team_league
                FROM leagues
                WHERE id = $1
            `,
            [SESSION_ID]
        );

        if (sessionRows.length === 0) {
            throw new Error(`Session not found for id ${SESSION_ID}`);
        }

        const session = sessionRows[0];
        if (session.type !== 'session') {
            throw new Error(`League ${SESSION_ID} is not a session`);
        }

        await client.query('BEGIN');

        const { rows: existingTeams } = await client.query(
            `
                SELECT id, name, tid
                FROM teams
                WHERE league_id = $1
                ORDER BY created_at ASC
            `,
            [SESSION_ID]
        );

        const teamNameSet = new Set(existingTeams.map((team) => team.name));
        const tidSet = new Set(existingTeams.map((team) => team.tid));

        let teamSeed = Date.now() % 10000;
        while (
            TEAM_DEFS.some((team, index) => {
                const candidateTid = `${team.tidPrefix}${String(teamSeed + index).padStart(4, '0')}`;
                return tidSet.has(candidateTid);
            })
        ) {
            teamSeed += 1;
        }

        const createdTeams = [];

        for (let teamIndex = 0; teamIndex < TEAM_DEFS.length; teamIndex += 1) {
            const teamDef = TEAM_DEFS[teamIndex];

            if (teamNameSet.has(teamDef.name)) {
                throw new Error(`Team name "${teamDef.name}" already exists in this session`);
            }

            const teamId = crypto.randomUUID();
            const teamTid = `${teamDef.tidPrefix}${String(teamSeed + teamIndex).padStart(4, '0')}`;
            const players = [];

            for (let playerIndex = 0; playerIndex < 6; playerIndex += 1) {
                const profileId = crypto.randomUUID();
                const firstName = teamIndex === 0 ? 'Breaker' : 'Runner';
                const fullName = `${firstName} Dummy ${playerIndex + 1 + teamIndex * 6}`;
                const nickname = `${teamDef.tidPrefix}${playerIndex + 1}`;
                const playerNumber = makePlayerNumber(teamSeed + teamIndex, playerIndex + 1);
                const email = `${teamDef.tidPrefix.toLowerCase()}_${teamSeed}_${playerIndex + 1}@dummy.breakpoint.test`;
                const rating = teamDef.ratings[playerIndex];

                await client.query(
                    `
                        INSERT INTO profiles (
                            id,
                            email,
                            full_name,
                            nickname,
                            player_number,
                            breakpoint_rating,
                            fargo_rating,
                            role,
                            is_active
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, 'player', true)
                    `,
                    [profileId, email, fullName, nickname, playerNumber, rating, rating]
                );

                await client.query(
                    `
                        INSERT INTO league_players (
                            league_id,
                            player_id,
                            breakpoint_rating,
                            payment_status,
                            paid,
                            amount_paid,
                            status,
                            is_primary
                        )
                        VALUES ($1, $2, $3, 'paid', true, 0, 'active', false)
                    `,
                    [SESSION_ID, profileId, rating]
                );

                players.push({
                    id: profileId,
                    fullName,
                    nickname,
                    playerNumber,
                    rating,
                });
            }

            await client.query(
                `
                    INSERT INTO teams (
                        id,
                        league_id,
                        name,
                        captain_id,
                        tid,
                        status
                    )
                    VALUES ($1, $2, $3, $4, $5, 'approved')
                `,
                [teamId, SESSION_ID, teamDef.name, players[0].id, teamTid]
            );

            for (const player of players) {
                await client.query(
                    `
                        INSERT INTO team_members (team_id, player_id)
                        VALUES ($1, $2)
                    `,
                    [teamId, player.id]
                );
            }

            createdTeams.push({
                id: teamId,
                tid: teamTid,
                name: teamDef.name,
                captain: players[0],
                players,
            });
        }

        await client.query(
            `
                UPDATE league_players
                SET payment_status = 'paid',
                    paid = true,
                    amount_paid = COALESCE(amount_paid, 0)
                WHERE league_id = $1
            `,
            [SESSION_ID]
        );

        await client.query(
            `
                UPDATE teams
                SET status = 'approved'
                WHERE league_id = $1
            `,
            [SESSION_ID]
        );

        const { rows: feeColumnRows } = await client.query(
            `
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'leagues'
                  AND column_name = 'creation_fee_status'
                LIMIT 1
            `
        );

        if (feeColumnRows.length > 0) {
            await client.query(
                `
                    UPDATE leagues
                    SET creation_fee_status = 'paid'
                    WHERE id = $1
                `,
                [SESSION_ID]
            );
        }

        await client.query('COMMIT');

        console.log(`Seeded 2 dummy teams into session "${session.name}" (${SESSION_ID})`);
        for (const team of createdTeams) {
            console.log(`\n${team.name} [${team.tid}]`);
            console.log(`Captain: ${team.captain.fullName} (${team.captain.playerNumber})`);
            for (const player of team.players) {
                console.log(
                    `- ${player.fullName} | nickname=${player.nickname} | player_number=${player.playerNumber} | rating=${player.rating}`
                );
            }
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Failed to seed dummy teams:', error);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

main();
