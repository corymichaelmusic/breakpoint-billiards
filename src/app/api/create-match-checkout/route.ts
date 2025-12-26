import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-12-15.clover' as any,
});

export async function POST(req: Request) {
    if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Server misconfiguration: Missing Stripe Key' }, { status: 500 });
    }
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

        // 3. Create Stripe Session
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://breakpoint.app';

        const priceId = process.env.STRIPE_PRICE_ID;

        const lineItems = priceId
            ? [{ price: priceId, quantity: 1 }]
            : [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'League Match Fee',
                        description: 'Match payment for Breakpoint Billiards',
                    },
                    unit_amount: 2000,
                },
                quantity: 1,
            }];

        const session = await stripe.checkout.sessions.create({
            line_items: lineItems,
            mode: 'payment',
            success_url: `${appUrl}/payment/success?match_id=${matchId}`,
            cancel_url: `${appUrl}/match/${matchId}`,
            metadata: {
                match_id: matchId,
                player_id: userId,
                role: isP1 ? 'player1' : 'player2',
                type: 'match_fee'
            },
        });

        if (!session.url) {
            throw new Error('Failed to create Stripe session URL');
        }

        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error('Checkout creation failed:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
