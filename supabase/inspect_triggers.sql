
SELECT 
    event_object_table as table_name,
    trigger_name, 
    action_statement as trigger_action,
    action_orientation,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'profiles';
