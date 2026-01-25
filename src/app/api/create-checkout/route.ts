import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';



export async function POST(req: Request) {
    if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Server misconfiguration: Missing Stripe Key' }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-12-18.acacia' as any,
    });
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { type, source } = body;

        // Always use the web URL as base - for mobile, we'll pass a source param
        // and the web page will redirect to the app using deep links
        const webBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://breakpoint.app';
        const isMobile = source === 'mobile';

        const supabase = await createClient();

        let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
        let metadata: any = { type, player_id: userId };

        // Construct URLs - for mobile, add source param so web page knows to redirect to app
        const baseUrl = webBaseUrl.endsWith('/') ? webBaseUrl.slice(0, -1) : webBaseUrl;
        const sourceParam = isMobile ? '&source=mobile' : '';

        let successUrl = `${baseUrl}/payment/success`;
        let cancelUrl = isMobile ? `${baseUrl}/dashboard?source=mobile` : `${baseUrl}/dashboard`;

        if (type === 'match_fee') {
            const { matchId } = body;
            if (!matchId) return NextResponse.json({ error: 'Match ID required' }, { status: 400 });

            // Verify Match and get league info for match fee
            const { data: match, error: matchError } = await supabase
                .from('matches')
                .select('id, league_id, player1_id, player2_id, payment_status_p1, payment_status_p2')
                .eq('id', matchId)
                .single();

            if (matchError || !match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
            if (match.player1_id !== userId && match.player2_id !== userId) return NextResponse.json({ error: 'Not a participant' }, { status: 403 });

            const isP1 = match.player1_id === userId;
            const currentStatus = isP1 ? match.payment_status_p1 : match.payment_status_p2;

            if (['paid', 'paid_online', 'waived'].includes(currentStatus)) {
                return NextResponse.json({ error: 'Already paid' }, { status: 400 });
            }

            // Fetch global match fee from system settings
            let matchFeeAmount = 20; // Default $20
            const { data: matchFeeSetting } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'default_match_fee')
                .single();

            if (matchFeeSetting && matchFeeSetting.value) {
                matchFeeAmount = Number(matchFeeSetting.value);
            }

            metadata.match_id = matchId;
            metadata.role = isP1 ? 'player1' : 'player2';
            successUrl = `${baseUrl}/payment/success?match_id=${matchId}${sourceParam}`;
            cancelUrl = isMobile ? `${baseUrl}/dashboard?source=mobile` : `${baseUrl}/match/${matchId}`;

            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'League Match Fee' },
                    unit_amount: matchFeeAmount * 100, // Convert dollars to cents
                },
                quantity: 1,
            });

        } else if (type === 'session_creation') {
            const { leagueId } = body; // This is the Session ID (leagues table)
            if (!leagueId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

            // Fetch Session details to get fee and verify ownership
            const { data: session, error: sessionError } = await supabase
                .from('leagues')
                .select('id, name, creation_fee, creation_fee_status, operator_id')
                .eq('id', leagueId)
                .single();

            if (sessionError || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            if (session.operator_id !== userId) return NextResponse.json({ error: 'Unauthorized: Only operator can pay creation fee' }, { status: 403 });

            if (session.creation_fee_status === 'paid' || session.creation_fee_status === 'waived') {
                return NextResponse.json({ error: 'Creation fee already paid' }, { status: 400 });
            }

            const amount = (session.creation_fee || 250) * 100; // Default 250 if null, convert to cents
            metadata.league_id = leagueId;
            successUrl = `${baseUrl}/dashboard/operator/leagues/${leagueId}`;
            cancelUrl = `${baseUrl}/dashboard/operator/leagues/${leagueId}`;

            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: { name: `Session Creation Fee: ${session.name}` },
                    unit_amount: amount,
                },
                quantity: 1,
            });

        } else if (type === 'player_session_fee') {
            const { sessionId } = body;
            if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

            // Fetch Fee amount from Session
            const { data: session, error: sErr } = await supabase
                .from('leagues')
                .select('name, session_fee')
                .eq('id', sessionId)
                .single();

            if (sErr || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

            // Check if player is in session and unpaid
            const { data: lp, error: lpErr } = await supabase
                .from('league_players')
                .select('payment_status')
                .eq('league_id', sessionId)
                .eq('player_id', userId)
                .single();

            if (lpErr || !lp) return NextResponse.json({ error: 'You are not a member of this session' }, { status: 403 });
            if (['paid', 'paid_online', 'waived'].includes(lp.payment_status)) {
                return NextResponse.json({ error: 'Session fee already paid' }, { status: 400 });
            }

            const amount = (session.session_fee || 25) * 100; // Default 25
            metadata.session_id = sessionId;
            successUrl = isMobile ? `${baseUrl}/payment/success?session_id=${sessionId}${sourceParam}` : `${baseUrl}/dashboard`;
            cancelUrl = isMobile ? `${baseUrl}/dashboard?source=mobile` : `${baseUrl}/dashboard`;

            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: { name: `Session Fee: ${session.name}` },
                    unit_amount: amount,
                },
                quantity: 1,
            });

        } else if (type === 'pro_subscription') {
            // Check if user already has pro subscription
            const { data: profile } = await supabase
                .from('profiles')
                .select('subscription_status')
                .eq('id', userId)
                .single();

            if (profile?.subscription_status === 'pro') {
                return NextResponse.json({ error: 'You already have a Pro subscription' }, { status: 400 });
            }

            // In a real app, you'd fetch the price ID from env or DB
            const priceId = process.env.STRIPE_PRO_PRICE_ID;
            if (!priceId) {
                console.error('STRIPE_PRO_PRICE_ID is not set');
                return NextResponse.json({ error: 'Subscription configuration missing' }, { status: 500 });
            }

            metadata.type = 'pro_subscription';
            successUrl = isMobile ? `${baseUrl}/payment/success?type=pro${sourceParam}` : `${baseUrl}/dashboard`;
            cancelUrl = isMobile ? `${baseUrl}/dashboard?source=mobile` : `${baseUrl}/dashboard`;

            lineItems.push({
                price: priceId,
                quantity: 1,
            });

        } else {
            return NextResponse.json({ error: 'Invalid checkout type' }, { status: 400 });
        }

        const session = await stripe.checkout.sessions.create({
            line_items: lineItems,
            mode: type === 'pro_subscription' ? 'subscription' : 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: metadata,
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
