
-- BROAD DIAGNOSTIC
-- Lists ALL tables and columns in public schema
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, column_name;
