-- 1. Drop Defaults
ALTER TABLE leagues ALTER COLUMN bounty_val_8_run DROP DEFAULT;
ALTER TABLE leagues ALTER COLUMN bounty_val_9_run DROP DEFAULT;
ALTER TABLE leagues ALTER COLUMN bounty_val_9_snap DROP DEFAULT;
ALTER TABLE leagues ALTER COLUMN bounty_val_shutout DROP DEFAULT;

-- 2. Set 'Default' values to NULL for Sessions (to enable inheritance)
-- Only for sessions. Leagues should act as the source of truth, so keep them or set them?
-- Actually, if League has NULL, we fall back to HARD CODED defaults.
-- So verify what 'Default' means.
-- 8Run=5, 9Run=3, Snap=1, Shutout=1.

UPDATE leagues 
SET bounty_val_8_run = NULL 
WHERE bounty_val_8_run = 5 AND type = 'session';

UPDATE leagues 
SET bounty_val_9_run = NULL 
WHERE bounty_val_9_run = 3 AND type = 'session';

UPDATE leagues 
SET bounty_val_9_snap = NULL 
WHERE bounty_val_9_snap = 1 AND type = 'session';

UPDATE leagues 
SET bounty_val_shutout = NULL 
WHERE bounty_val_shutout = 1 AND type = 'session';
