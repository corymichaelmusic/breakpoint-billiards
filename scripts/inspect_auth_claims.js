const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const teamMatchId = process.argv[2];

    if (!teamMatchId) {
        throw new Error('Usage: node scripts/inspect_auth_claims.js <team_match_id>');
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    try {
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

        await client.query('BEGIN');

        await client.query(
            `select set_config('request.jwt.claim.sub', $1, true)`,
            [operatorId]
        );

        const directClaimResult = await client.query(
            `select current_setting('request.jwt.claim.sub', true) as sub,
                    auth.jwt() as jwt`
        );

        await client.query(
            `select set_config('request.jwt.claims', $1, true)`,
            [JSON.stringify({ sub: operatorId, role: 'authenticated' })]
        );

        const claimsResult = await client.query(
            `select current_setting('request.jwt.claims', true) as claims,
                    auth.jwt() as jwt`
        );

        await client.query('ROLLBACK');

        console.log(JSON.stringify({
            operatorId,
            directClaim: directClaimResult.rows[0],
            claimsObject: claimsResult.rows[0],
        }, null, 2));
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
