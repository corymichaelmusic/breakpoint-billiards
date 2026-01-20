const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config();
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        const p1Id = 'user_38V3jc7BblMLNW8oU6JLpYvbFY8'; // Savannah
        const p2Id = 'user_38V7Vlzg7uLY2ssFDXn1VE8he51'; // Quinton

        console.log("Checking Ratings...");
        const res = await client.query(`
            SELECT id, full_name, fargo_rating, breakpoint_rating 
            FROM profiles 
            WHERE id IN ($1, $2)
        `, [p1Id, p2Id]);

        console.table(res.rows);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
