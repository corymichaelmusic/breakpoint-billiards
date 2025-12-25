
import { Client } from 'pg';
import { NextResponse } from 'next/server';

export async function GET() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND (column_name LIKE '%id' OR column_name LIKE '%_by')
            AND data_type = 'uuid'
            ORDER BY table_name;
        `);
        return NextResponse.json({ rows: res.rows });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    } finally {
        await client.end();
    }
}
