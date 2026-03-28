const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');
const uuidv4 = crypto.randomUUID;

async function run() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Find the user
        const resUser = await client.query(`SELECT id FROM profiles WHERE player_number = '1000662'`);
        if (resUser.rows.length === 0) throw new Error("User not found");
        const userId = resUser.rows[0].id;
        console.log("Found User ID:", userId);
        
        // Remove rogue role constraint that broke user's 'add player' logic
        await client.query(`ALTER TABLE team_members DROP COLUMN IF EXISTS role;`);

        // 2. Create the remaining 11 dummy players
        const dummyPlayers = [];
        const baseId = 2000000;
        
        // 6 for the enemy team, 5 free for the user
        const ratings = [
            // Enemy team (Captain is first)
            700, 500, 400, 300, 200, 400,
            // Free players for user
            900, 600, 500, 300, 200
        ];
        
        for (let i = 0; i < 11; i++) {
            const pid = baseId + i;
            const uid = uuidv4();
            await client.query(`
                INSERT INTO profiles(id, email, full_name, nickname, player_number, breakpoint_rating, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, true)
                ON CONFLICT (id) DO NOTHING
            `, [
                uid,
                `dummy${i}@example.com`,
                `Dummy Player ${i+1}`,
                `Dum${i+1}`,
                pid.toString(),
                ratings[i]
            ]);
            dummyPlayers.push({ id: uid, player_number: pid.toString(), rating: ratings[i] });
        }
        
        // 3. Create Parent League
        const parentId = uuidv4();
        await client.query(`
            INSERT INTO leagues(id, name, type, status, operator_id)
            VALUES ($1, 'Team League Beta', 'league', 'active', $2)
        `, [parentId, userId]);
        
        // 4. Create Session
        const sessionId = uuidv4();
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + 3);
        
        await client.query(`
            INSERT INTO leagues(id, parent_league_id, name, type, status, is_team_league, start_date, end_date, operator_id)
            VALUES ($1, $2, 'Spring 2026 Team Session', 'session', 'active', true, NOW(), $3, $4)
        `, [sessionId, parentId, futureDate, userId]);
        
        console.log("Created League Session ID:", sessionId);

        // Add user and dummy players to the league_players so they are "joined" (or they should join manually?)
        // The prompt says "...let me join the session, create a team..."
        // So the user is NOT joined yet. But the dummy players should be joined.
        
        for (let i = 0; i < 11; i++) {
            await client.query(`
                INSERT INTO league_players(league_id, player_id, breakpoint_rating)
                VALUES ($1, $2, $3)
            `, [sessionId, dummyPlayers[i].id, dummyPlayers[i].rating]);
        }
        
        // 5. Create Enemy Team
        const enemyTeamId = uuidv4();
        await client.query(`
            INSERT INTO teams(id, league_id, name, captain_id)
            VALUES ($1, $2, 'The Terminators', $3)
        `, [enemyTeamId, sessionId, dummyPlayers[0].id]);
        
        // Add first 6 players to enemy team
        for (let i = 0; i < 6; i++) {
            await client.query(`
                INSERT INTO team_members(team_id, player_id)
                VALUES ($1, $2)
            `, [enemyTeamId, dummyPlayers[i].id]);
        }
        
        await client.query('COMMIT');
        
        console.log("-----------------------------------------");
        console.log("Success! Dummy Data Created.");
        console.log("Enemy Team: 'The Terminators' (6 players)");
        console.log("Your Free players to invite:");
        for(let i = 6; i < 11; i++) {
            console.log(`- Dummy Player ${i+1} : Member ID ${dummyPlayers[i].player_number} (Rating: ${dummyPlayers[i].rating})`);
        }
        console.log("Remember to join the 'Spring 2026 Team Session' first!");
        
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
