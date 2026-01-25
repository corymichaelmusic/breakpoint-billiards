import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin'; // Use Admin Client for Webhooks
import Stripe from 'stripe';

export async function POST(req: Request) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!endpointSecret || !stripeKey) {
        console.error('STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY is not set');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey, {
        apiVersion: '2024-12-18.acacia' as any,
    });

    const payload = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const metadata = session.metadata;

            if (metadata) {
                const supabase = createAdminClient();

                if (metadata.type === 'match_fee' && metadata.match_id && metadata.role) {

                    // Verify Match Exists
                    const { data: match } = await supabase.from('matches').select('id').eq('id', metadata.match_id).single();
                    if (!match) {
                        console.error(`Match not found: ${metadata.match_id}`);
                        return NextResponse.json({ error: 'Match not found' }, { status: 404 });
                    }

                    const updateData: any = {};
                    if (metadata.role === 'player1') {
                        updateData.payment_status_p1 = 'paid_online';
                    } else if (metadata.role === 'player2') {
                        updateData.payment_status_p2 = 'paid_online';
                    }

                    const { error } = await supabase
                        .from('matches')
                        .update(updateData)
                        .eq('id', metadata.match_id);

                    if (error) {
                        console.error('Failed to update match payment status:', error);
                        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
                    }
                    // Payment processed successfully

                } else if (metadata.type === 'session_creation' && metadata.league_id) {

                    // Verify Exists
                    const { count } = await supabase.from('leagues').select('*', { count: 'exact', head: true }).eq('id', metadata.league_id);
                    if (count === 0) {
                        return NextResponse.json({ error: 'League not found' }, { status: 404 });
                    }

                    const { error } = await supabase
                        .from('leagues')
                        .update({ creation_fee_status: 'paid' })
                        .eq('id', metadata.league_id);

                    if (error) {
                        console.error('Failed to update session creation status:', error);
                        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
                    }
                    // Session creation fee processed successfully

                } else if (metadata.type === 'player_session_fee' && metadata.session_id && metadata.player_id) {

                    // Verify Exists
                    const { count } = await supabase.from('league_players').select('*', { count: 'exact', head: true })
                        .eq('league_id', metadata.session_id)
                        .eq('player_id', metadata.player_id);

                    if (count === 0) {
                        return NextResponse.json({ error: 'Player record not found' }, { status: 404 });
                    }

                    const { error } = await supabase
                        .from('league_players')
                        .update({ payment_status: 'paid_online' })
                        .eq('league_id', metadata.session_id)
                        .eq('player_id', metadata.player_id);

                    if (error) {
                        console.error('Failed to update player session fee:', error);
                        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
                    }
                    // Player session fee processed successfully
                } else if (metadata.type === 'pro_subscription' && metadata.player_id) {
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            subscription_status: 'pro',
                            subscription_expires_at: null, // Active subscription
                            stripe_customer_id: session.customer as string // Save customer ID for later (cancellations/updates)
                        })
                        .eq('id', metadata.player_id);

                    if (error) {
                        console.error('Failed to update pro subscription status:', error);
                        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
                    }
                }
            }
        } else if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object as Stripe.Subscription;
            const supabase = createAdminClient();

            // We need to find the user by Stripe Customer ID or Metadata
            const customerId = subscription.customer as string;
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .single();

            if (profile) {
                await supabase
                    .from('profiles')
                    .update({
                        subscription_status: 'free',
                        subscription_expires_at: new Date().toISOString()
                    })
                    .eq('id', profile.id);
            }
        }

        return NextResponse.json({ received: true });

    } catch (err) {
        console.error('Webhook processing failed:', err);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}
