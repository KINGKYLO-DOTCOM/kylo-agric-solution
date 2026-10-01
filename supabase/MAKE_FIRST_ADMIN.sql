-- ============================================================
-- KYLO AGRIC SOLUTION
-- MAKE FIRST USER ADMIN
-- ============================================================

-- Replace YOUR-USER-UUID with the UUID
-- of the account you created.

update public.profiles

set role = 'admin'

where id = 'YOUR-USER-UUID';


-- Check the result

select
  id,
  full_name,
  phone,
  role,
  created_at

from public.profiles

where id = 'YOUR-USER-UUID';