-- Make requested_date nullable in reschedule_requests table to support generic unlock requests
ALTER TABLE reschedule_requests ALTER COLUMN requested_date DROP NOT NULL;
