-- ============================================================
-- KYLO AGRIC SOLUTION
-- BATCH 6 - ADMIN SECURITY
-- ============================================================

-- Make sure RLS is enabled.

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.enquiries enable row level security;
alter table public.profiles enable row level security;


-- ============================================================
-- PRODUCTS
-- ============================================================

drop policy if exists "products public read"
on public.products;

create policy "products public read"
on public.products
for select
using (
  is_active = true
  or public.is_admin()
);


-- Admins may manage products through Supabase/RLS.
-- The website itself uses the secure Netlify admin function.

drop policy if exists "products admin write"
on public.products;

create policy "products admin write"
on public.products
for all
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);


-- ============================================================
-- ORDERS
-- ============================================================

drop policy if exists "orders own read"
on public.orders;

create policy "orders own read"
on public.orders
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);


-- Remove direct customer INSERT access.
-- Orders should be created by the secure order-creation
-- backend/RPC rather than allowing customers to submit
-- arbitrary totals.

drop policy if exists "orders own insert"
on public.orders;


-- Admins may update orders.

drop policy if exists "orders admin update"
on public.orders;

create policy "orders admin update"
on public.orders
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);


-- ============================================================
-- ORDER ITEMS
-- ============================================================

drop policy if exists "order items own read"
on public.order_items;

create policy "order items own read"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and (
        o.user_id = auth.uid()
        or public.is_admin()
      )
  )
);


-- Customers must not directly insert order items.

drop policy if exists "order items own insert"
on public.order_items;


-- ============================================================
-- ENQUIRIES
-- ============================================================

drop policy if exists "enquiries own read"
on public.enquiries;

create policy "enquiries own read"
on public.enquiries
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);


drop policy if exists "enquiries admin update"
on public.enquiries;

create policy "enquiries admin update"
on public.enquiries
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);


-- ============================================================
-- PROFILES
-- ============================================================

drop policy if exists "profiles own read"
on public.profiles;

create policy "profiles own read"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
);


-- Customers can update their own profile,
-- but the role cannot be changed through this policy.

drop policy if exists "profiles own update"
on public.profiles;

create policy "profiles own update"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
)
with check (
  id = auth.uid()
);


-- ============================================================
-- IMPORTANT SECURITY NOTE
-- ============================================================
--
-- SUPABASE_SERVICE_ROLE_KEY must NEVER be placed inside:
--
--   js/
--   HTML
--   CSS
--   GitHub frontend code
--
-- It belongs only in Netlify environment variables.
--
-- Required Netlify variables:
--
-- SUPABASE_URL
-- SUPABASE_SERVICE_ROLE_KEY
--
-- ============================================================


select
  'Batch 6 admin security migration completed.'
  as result;