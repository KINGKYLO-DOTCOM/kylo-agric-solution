-- ============================================================
-- KYLO AGRIC SOLUTION
-- BATCH 7 - ADMIN SECURITY
-- ============================================================

-- ============================================================
-- 1. PRODUCTS
-- ============================================================

-- Public users/customers may read active products.
-- Product creation/update/deletion is handled by the
-- secure Netlify Admin API.

DROP POLICY IF EXISTS "Public can view active products"
ON public.products;

CREATE POLICY "Public can view active products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
);

-- Remove browser-side product modification policies.
DROP POLICY IF EXISTS "Admins can insert products"
ON public.products;

DROP POLICY IF EXISTS "Admins can update products"
ON public.products;

DROP POLICY IF EXISTS "Admins can delete products"
ON public.products;

DROP POLICY IF EXISTS "Authenticated users can insert products"
ON public.products;

DROP POLICY IF EXISTS "Authenticated users can update products"
ON public.products;

DROP POLICY IF EXISTS "Authenticated users can delete products"
ON public.products;


-- ============================================================
-- 2. ORDERS
-- ============================================================

-- Customers can view their own orders.

DROP POLICY IF EXISTS "Users can view own orders"
ON public.orders;

DROP POLICY IF EXISTS "Customers can view own orders"
ON public.orders;

CREATE POLICY "Customers can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Customers must NOT create or modify orders directly
-- from the browser.
--
-- Order creation is performed by:
-- netlify/functions/create-order.mjs
--
-- Order status changes are performed by:
-- netlify/functions/admin-api.mjs

DROP POLICY IF EXISTS "Users can insert own orders"
ON public.orders;

DROP POLICY IF EXISTS "Customers can insert own orders"
ON public.orders;

DROP POLICY IF EXISTS "Users can update own orders"
ON public.orders;

DROP POLICY IF EXISTS "Customers can update own orders"
ON public.orders;

DROP POLICY IF EXISTS "Users can delete own orders"
ON public.orders;

DROP POLICY IF EXISTS "Customers can delete own orders"
ON public.orders;


-- ============================================================
-- 3. ORDER ITEMS
-- ============================================================

DROP POLICY IF EXISTS "Users can view own order items"
ON public.order_items;

DROP POLICY IF EXISTS "Customers can view own order items"
ON public.order_items;

CREATE POLICY "Customers can view own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE public.orders.id = order_items.order_id
      AND public.orders.user_id = auth.uid()
  )
);

-- No direct browser insertion/update/deletion.
-- Server-side functions handle order creation.

DROP POLICY IF EXISTS "Users can insert own order items"
ON public.order_items;

DROP POLICY IF EXISTS "Customers can insert own order items"
ON public.order_items;

DROP POLICY IF EXISTS "Users can update own order items"
ON public.order_items;

DROP POLICY IF EXISTS "Customers can update own order items"
ON public.order_items;

DROP POLICY IF EXISTS "Users can delete own order items"
ON public.order_items;

DROP POLICY IF EXISTS "Customers can delete own order items"
ON public.order_items;


-- ============================================================
-- 4. ENQUIRIES
-- ============================================================

-- Keep enquiry creation available for website visitors.

DROP POLICY IF EXISTS "Anyone can submit enquiries"
ON public.enquiries;

CREATE POLICY "Anyone can submit enquiries"
ON public.enquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (
  true
);

-- A customer may view their own enquiries if the schema
-- associates enquiries with a user_id.

DROP POLICY IF EXISTS "Users can view own enquiries"
ON public.enquiries;

CREATE POLICY "Users can view own enquiries"
ON public.enquiries
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Status changes are performed through the secure
-- administrator API.

DROP POLICY IF EXISTS "Admins can update enquiries"
ON public.enquiries;

DROP POLICY IF EXISTS "Users can update enquiries"
ON public.enquiries;

DROP POLICY IF EXISTS "Customers can update enquiries"
ON public.enquiries;


-- ============================================================
-- 5. PROFILES
-- ============================================================

-- Customers can view their own profile.

DROP POLICY IF EXISTS "Users can view own profile"
ON public.profiles;

DROP POLICY IF EXISTS "Customers can view own profile"
ON public.profiles;

CREATE POLICY "Customers can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
);

-- Customers can update their own personal information.
-- IMPORTANT:
-- The role column must NOT be changed by normal clients.
--
-- This policy intentionally uses the existing role value
-- from the database rather than trusting a submitted role.

DROP POLICY IF EXISTS "Users can update own profile"
ON public.profiles;

DROP POLICY IF EXISTS "Customers can update own profile"
ON public.profiles;

CREATE POLICY "Customers can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
)
WITH CHECK (
  id = auth.uid()
  AND role = (
    SELECT p.role
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
  )
);


-- ============================================================
-- 6. GRANTS
-- ============================================================

GRANT SELECT
ON public.products
TO anon, authenticated;

GRANT SELECT
ON public.orders
TO authenticated;

GRANT SELECT
ON public.order_items
TO authenticated;

GRANT SELECT, INSERT
ON public.enquiries
TO anon, authenticated;

GRANT SELECT, UPDATE
ON public.profiles
TO authenticated;


-- ============================================================
-- 7. VERIFICATION
-- ============================================================

SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'profiles',
  'products',
  'orders',
  'order_items',
  'enquiries'
)
ORDER BY tablename;