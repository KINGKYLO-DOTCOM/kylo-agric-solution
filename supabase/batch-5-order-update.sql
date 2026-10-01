-- =====================================================
-- KYLO AGRIC SOLUTION
-- BATCH 5 DATABASE UPDATE
-- =====================================================


-- =====================================================
-- 1. ORDERS TABLE
-- =====================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS fulfilment_method text
CHECK (
  fulfilment_method IN (
    'collection',
    'delivery'
  )
)
DEFAULT 'collection';


ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_note text;


-- =====================================================
-- 2. ORDER TOTAL FIELDS
-- =====================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS subtotal numeric(12,2)
DEFAULT 0;


ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_fee numeric(12,2)
DEFAULT 0;


ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS total numeric(12,2)
DEFAULT 0;


-- =====================================================
-- 3. ENABLE RLS
-- =====================================================

ALTER TABLE public.orders
ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.order_items
ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 4. REMOVE OLD CUSTOMER SELECT POLICIES
-- =====================================================

DROP POLICY IF EXISTS
"Users can view own orders"
ON public.orders;


DROP POLICY IF EXISTS
"Customers can view own orders"
ON public.orders;


DROP POLICY IF EXISTS
"Users can view own order items"
ON public.order_items;


DROP POLICY IF EXISTS
"Customers can view own order items"
ON public.order_items;


-- =====================================================
-- 5. CUSTOMER CAN VIEW OWN ORDERS
-- =====================================================

CREATE POLICY
"Users can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);


-- =====================================================
-- 6. CUSTOMER CAN VIEW OWN ORDER ITEMS
-- =====================================================

CREATE POLICY
"Users can view own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders AS o
    WHERE o.id = order_items.order_id
      AND o.user_id = auth.uid()
  )
);


-- =====================================================
-- 7. GRANTS
-- =====================================================

GRANT SELECT
ON public.orders
TO authenticated;


GRANT SELECT
ON public.order_items
TO authenticated;


-- =====================================================
-- 8. VERIFY
-- =====================================================

SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
ORDER BY ordinal_position;