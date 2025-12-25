
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE oid = 'reschedule_requests'::regclass;
