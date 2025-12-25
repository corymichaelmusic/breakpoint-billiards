import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { Polar } from '@polar-sh/sdk';

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { matchId } = await req.json();
        if (!matchId) {
            return NextResponse.json({ error: 'Match ID required' }, { status: 400 });
        }

        // 1. Verify User is part of the match
        const supabase = await createClient();
        const { data: match, error } = await supabase
            .from('matches')
            .select('id, player1_id, player2_id, payment_status_p1, payment_status_p2')
            .eq('id', matchId)
            .single();

        if (error || !match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        if (match.player1_id !== userId && match.player2_id !== userId) {
            return NextResponse.json({ error: 'Not a participant in this match' }, { status: 403 });
        }

        // 2. Check if already paid
        const isP1 = match.player1_id === userId;
        const currentStatus = isP1 ? match.payment_status_p1 : match.payment_status_p2;

        if (currentStatus === 'paid' || currentStatus === 'paid_online' || currentStatus === 'waived') {
            return NextResponse.json({ error: 'Already paid' }, { status: 400 });
        }

        // 3. Initialize Polar
        const polar = new Polar({
            accessToken: process.env.POLAR_ACCESS_TOKEN,
            server: (process.env.POLAR_SERVER ?? 'sandbox') as any, // Default to sandbox if not set
        });

        // 4. Create Checkout
        // We assume a fixed Product ID for "Match Fee" is configured, or we create a custom checkout if supported.
        // Ideally, we have a Generic "Match Fee" product in Polar.
        const productId = process.env.POLAR_MATCH_FEE_PRODUCT_ID;

        if (!productId) {
            console.error("Missing POLAR_MATCH_FEE_PRODUCT_ID env var");
            return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
        }

        const result = await polar.checkouts.create({
            productId: productId,
            successUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://breakpoint.app'}/payment/success?match_id=${matchId}`,
            metadata: {
                match_id: matchId,
                player_id: userId,
                role: isP1 ? 'player1' : 'player2',
                type: 'match_fee'
            },
        } as any);

        return NextResponse.json({ url: result.url });

    } catch (error) {
        console.error('Checkout creation failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
