-- Add granular payment status columns
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS payment_status_8ball_p1 text DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_status_8ball_p2 text DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_status_9ball_p1 text DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_status_9ball_p2 text DEFAULT 'unpaid';

-- Migrate existing Data: If generic status is 'paid_cash' etc, apply to both.
UPDATE matches SET payment_status_8ball_p1 = payment_status_p1 WHERE payment_status_p1 != 'unpaid';
UPDATE matches SET payment_status_8ball_p2 = payment_status_p2 WHERE payment_status_p2 != 'unpaid';
UPDATE matches SET payment_status_9ball_p1 = payment_status_p1 WHERE payment_status_p1 != 'unpaid';
UPDATE matches SET payment_status_9ball_p2 = payment_status_p2 WHERE payment_status_p2 != 'unpaid';
