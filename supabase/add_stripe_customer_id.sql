-- Add stripe_customer_id column to profiles table
-- Required for the Stripe webhook to update subscription status on purchase
-- and to look up users when subscriptions are cancelled
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
