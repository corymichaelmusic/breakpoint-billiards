import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
    if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-12-18.acacia' as any,
    });

    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createAdminClient();

        // Get the user's stripe_customer_id
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('stripe_customer_id, subscription_status')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        if (profile.subscription_status !== 'pro') {
            return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 400 });
        }

        if (!profile.stripe_customer_id) {
            // No Stripe customer ID — just downgrade directly (admin-granted pro, etc.)
            await supabase
                .from('profiles')
                .update({
                    subscription_status: 'free',
                    subscription_expires_at: new Date().toISOString()
                })
                .eq('id', userId);

            return NextResponse.json({ cancelled: true, immediate: true });
        }

        // Find the active subscription for this customer
        const subscriptions = await stripe.subscriptions.list({
            customer: profile.stripe_customer_id,
            status: 'active',
            limit: 1,
        });

        if (subscriptions.data.length === 0) {
            // No active Stripe subscription found — just downgrade directly
            await supabase
                .from('profiles')
                .update({
                    subscription_status: 'free',
                    subscription_expires_at: new Date().toISOString()
                })
                .eq('id', userId);

            return NextResponse.json({ cancelled: true, immediate: true });
        }

        // Cancel at period end — user keeps pro until billing cycle ends
        const subscription = await stripe.subscriptions.update(subscriptions.data[0].id, {
            cancel_at_period_end: true,
        });

        // Store when their access will expire
        const periodEnd = new Date((subscription as any).current_period_end * 1000).toISOString();
        await supabase
            .from('profiles')
            .update({ subscription_expires_at: periodEnd })
            .eq('id', userId);

        return NextResponse.json({
            cancelled: true,
            immediate: false,
            expires_at: periodEnd,
        });

    } catch (error: any) {
        console.error('Cancel subscription failed:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
