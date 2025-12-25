
select column_name, data_type 
from information_schema.columns 
where table_name = 'profiles'; -- Assuming 'profiles' is the public view for users
