/**
 * Sync Stripe Subscriptions to Database
 * 
 * This script:
 * 1. Fetches all subscriptions from Stripe (active + canceled)
 * 2. Matches them to users via checkout session metadata (player_id)
 * 3. Updates the profiles table with subscription_status and stripe_customer_id
 * 
 * Usage: node scripts/sync_stripe_subscriptions.js [--dry-run]
 */

require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log(`\n🔄 Syncing Stripe subscriptions to database${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

    // 1. Fetch ALL subscriptions from Stripe (active, canceled, past_due, etc.)
    const allSubscriptions = [];
    let hasMore = true;
    let startingAfter = undefined;

    while (hasMore) {
        const params = { limit: 100, expand: ['data.customer'] };
        if (startingAfter) params.starting_after = startingAfter;

        const batch = await stripe.subscriptions.list(params);
        allSubscriptions.push(...batch.data);
        hasMore = batch.has_more;
        if (batch.data.length > 0) {
            startingAfter = batch.data[batch.data.length - 1].id;
        }
    }

    // Also fetch canceled subscriptions (they don't show up in the default list)
    hasMore = true;
    startingAfter = undefined;
    while (hasMore) {
        const params = { limit: 100, status: 'canceled', expand: ['data.customer'] };
        if (startingAfter) params.starting_after = startingAfter;

        const batch = await stripe.subscriptions.list(params);
        allSubscriptions.push(...batch.data);
        hasMore = batch.has_more;
        if (batch.data.length > 0) {
            startingAfter = batch.data[batch.data.length - 1].id;
        }
    }

    console.log(`📊 Found ${allSubscriptions.length} total subscriptions in Stripe\n`);

    // 2. For each subscription, find the associated player_id via checkout sessions
    const updates = [];

    for (const sub of allSubscriptions) {
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const customerEmail = typeof sub.customer === 'string' ? null : sub.customer.email;

        // Try to find player_id from checkout sessions for this subscription
        let playerId = null;

        // Check subscription metadata first
        if (sub.metadata?.player_id) {
            playerId = sub.metadata.player_id;
        }

        // If not in subscription metadata, check the checkout session that created it
        if (!playerId) {
            try {
                const sessions = await stripe.checkout.sessions.list({
                    subscription: sub.id,
                    limit: 1,
                });
                if (sessions.data.length > 0 && sessions.data[0].metadata?.player_id) {
                    playerId = sessions.data[0].metadata.player_id;
                }
            } catch (e) {
                // Checkout session might not exist for some subscriptions
            }
        }

        // If still no player_id, try to find by email in profiles
        if (!playerId && customerEmail) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', customerEmail)
                .single();
            if (profile) {
                playerId = profile.id;
            }
        }

        if (!playerId) {
            console.log(`⚠️  Could not find player for subscription ${sub.id} (customer: ${customerId}, email: ${customerEmail || 'N/A'})`);
            continue;
        }

        const isActive = sub.status === 'active' || sub.status === 'trialing';
        const isCanceling = sub.cancel_at_period_end;
        const periodEnd = new Date(sub.current_period_end * 1000);

        let newStatus, expiresAt;

        if (isActive && !isCanceling) {
            newStatus = 'pro';
            expiresAt = null; // Active, no expiration
        } else if (isActive && isCanceling) {
            newStatus = 'pro'; // Still pro until period ends
            expiresAt = periodEnd.toISOString();
        } else {
            newStatus = 'free';
            expiresAt = new Date().toISOString();
        }

        updates.push({
            playerId,
            customerId,
            newStatus,
            expiresAt,
            stripeSubId: sub.id,
            stripeStatus: sub.status,
            cancelAtPeriodEnd: isCanceling,
            periodEnd,
            email: customerEmail,
        });
    }

    // 3. Apply updates
    console.log(`\n📋 Updates to apply:\n`);
    console.log('─'.repeat(100));
    console.log(`${'Player ID'.padEnd(40)} ${'Status'.padEnd(10)} ${'Stripe Status'.padEnd(15)} ${'Expires'.padEnd(25)} Email`);
    console.log('─'.repeat(100));

    for (const u of updates) {
        const expiresStr = u.expiresAt ? new Date(u.expiresAt).toLocaleDateString() : 'Never (active)';
        console.log(`${u.playerId.padEnd(40)} ${u.newStatus.padEnd(10)} ${u.stripeStatus.padEnd(15)} ${expiresStr.padEnd(25)} ${u.email || 'N/A'}`);

        if (!DRY_RUN) {
            const { error } = await supabase
                .from('profiles')
                .update({
                    subscription_status: u.newStatus,
                    subscription_expires_at: u.expiresAt,
                    stripe_customer_id: u.customerId,
                })
                .eq('id', u.playerId);

            if (error) {
                console.error(`   ❌ Failed to update ${u.playerId}:`, error.message);
            } else {
                console.log(`   ✅ Updated`);
            }
        }
    }

    console.log('─'.repeat(100));
    console.log(`\n✅ Done! ${updates.length} subscriptions processed.${DRY_RUN ? ' (DRY RUN — no changes made)' : ''}\n`);
}

main().catch(console.error);
