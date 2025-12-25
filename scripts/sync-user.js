const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function syncUser() {
    // 1. Fetch users from Clerk
    console.log('Fetching users from Clerk...');
    const clerkResponse = await fetch('https://api.clerk.com/v1/users?limit=1', {
        headers: {
            'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (!clerkResponse.ok) {
        console.error('Failed to fetch from Clerk:', await clerkResponse.text());
        return;
    }

    const users = await clerkResponse.json();
    if (users.length === 0) {
        console.log('No users found in Clerk.');
        return;
    }

    const user = users[0];
    const id = user.id;
    const email = user.email_addresses[0]?.email_address;
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    console.log(`Found user: ${email} (${id})`);

    // 2. Insert into Supabase
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const res = await client.query(`
      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES ($1, $2, $3, 'operator')
      ON CONFLICT (id) DO UPDATE
      SET role = 'operator'
      RETURNING *;
    `, [id, email, fullName]);

        console.log('Synced user:', res.rows[0]);

    } catch (err) {
        console.error('Error syncing user:', err);
    } finally {
        await client.end();
    }
}

syncUser();
