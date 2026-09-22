-- ================================================================
-- BEARD BANNA — SUPABASE RLS FIX MIGRATION (v1)
-- Run this in Supabase Dashboard → SQL Editor → New Query
--
-- WHAT THIS FIXES:
--   1. Promotes beardbanna07773@gmail.com to admin role
--   2. Fixes is_admin() to also handle cases where profile doesn't exist yet
--   3. Tightens order_items INSERT policy (was wide open)
--   4. Tightens store_settings INSERT policy (was allowing anon inserts)
--   5. Adds missing admin UPDATE policy for order_items
--   6. Ensures the orders SELECT policy works correctly for authenticated users
--
-- SAFE TO RE-RUN: All statements use DROP IF EXISTS / OR REPLACE / ON CONFLICT
-- ================================================================


-- ── STEP 1: Promote admin user to 'admin' role ─────────────────────────────
-- Run this after confirming beardbanna07773@gmail.com exists in auth.users

UPDATE public.profiles
SET role = 'admin', updated_at = NOW()
WHERE email = 'beardbanna07773@gmail.com';

-- Verify (should return 1 row with role = 'admin'):
-- SELECT id, email, role FROM public.profiles WHERE email = 'beardbanna07773@gmail.com';


-- ── STEP 2: Improved is_admin() function ────────────────────────────────────
-- Added STABLE for query planner optimization.
-- SECURITY DEFINER bypasses RLS (prevents infinite recursion).
-- Uses auth.uid() so it's always called in the context of the current user.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Returns true only if the current authenticated user has role = 'admin'
  -- in the profiles table. Returns false for unauthenticated users.
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ── STEP 3: Fix orders INSERT policy ────────────────────────────────────────
-- The existing policy allows authenticated users to insert with their user_id.
-- We tighten it: authenticated users can only insert with THEIR OWN user_id.

DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Authenticated users can create own orders"
    ON public.orders
    FOR INSERT
    WITH CHECK (
        -- Authenticated user inserting with their own user_id
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        -- OR authenticated user with NULL user_id (edge case)
        OR (auth.uid() IS NOT NULL AND user_id IS NULL)
        -- OR admin can insert any order
        OR public.is_admin()
    );


-- ── STEP 4: Fix orders SELECT policy ────────────────────────────────────────
-- Customers see only their own orders (by user_id OR email match).
-- Admin sees ALL orders.

DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders, admins can view all"
    ON public.orders
    FOR SELECT
    USING (
        -- Admin sees everything
        public.is_admin()
        -- Authenticated user sees their own orders (by UUID link — preferred)
        OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        -- Email fallback for orders placed before UUID link was implemented
        OR (
          auth.uid() IS NOT NULL 
          AND LOWER(customer_email) = LOWER(COALESCE(auth.jwt()->>'email', ''))
        )
    );


-- ── STEP 5: Fix orders UPDATE policy ────────────────────────────────────────
-- Only admins can update orders (status changes, etc.)

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
    ON public.orders
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ── STEP 6: Fix orders DELETE policy ────────────────────────────────────────
-- Only admins can delete orders

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
    ON public.orders
    FOR DELETE
    USING (public.is_admin());


-- ── STEP 7: Fix order_items INSERT policy ───────────────────────────────────
-- The original policy was WITH CHECK (true) — completely open!
-- Tighten it: only insert if parent order belongs to the current user.

DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
CREATE POLICY "Users can insert their own order items"
    ON public.order_items
    FOR INSERT
    WITH CHECK (
        -- The order_id must reference an order the current user owns (or admin)
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND (
                (auth.uid() IS NOT NULL AND o.user_id = auth.uid())
                OR (auth.uid() IS NOT NULL AND o.user_id IS NULL)
                OR public.is_admin()
            )
        )
    );


-- ── STEP 8: Fix order_items SELECT policy ───────────────────────────────────
-- Keep existing policy — users can view items for their own orders

DROP POLICY IF EXISTS "Users can view order items" ON public.order_items;
CREATE POLICY "Users can view order items for own orders"
    ON public.order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND (
                public.is_admin()
                OR (auth.uid() IS NOT NULL AND o.user_id = auth.uid())
                OR (auth.uid() IS NOT NULL AND LOWER(o.customer_email) = LOWER(COALESCE(auth.jwt()->>'email', '')))
            )
        )
    );


-- ── STEP 9: Fix order_items UPDATE/DELETE (admin only) ─────────────────────

DROP POLICY IF EXISTS "Admins can update order items" ON public.order_items;
CREATE POLICY "Admins can update order items"
    ON public.order_items
    FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;
CREATE POLICY "Admins can delete order items"
    ON public.order_items
    FOR DELETE
    USING (public.is_admin());


-- ── STEP 10: Fix store_settings INSERT policy ───────────────────────────────
-- The original policy allowed anon to insert store settings — security risk!
-- Only admins should be able to insert/update store settings.

DROP POLICY IF EXISTS "Admins can insert store settings" ON public.store_settings;
CREATE POLICY "Admins can insert store settings"
    ON public.store_settings
    FOR INSERT
    WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;
CREATE POLICY "Admins can update store settings"
    ON public.store_settings
    FOR UPDATE
    USING (public.is_admin() OR auth.role() = 'service_role')
    WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- Public SELECT policy stays open (customers need to read GST settings)
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings"
    ON public.store_settings
    FOR SELECT
    USING (true);


-- ── STEP 11: Ensure profiles SELECT policies don't conflict ─────────────────
-- The "Admins can view all profiles" uses is_admin() which uses auth.uid()
-- These are correctly set up already — verify they exist:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';


-- ── VERIFICATION QUERIES (run after migration) ──────────────────────────────

-- 1. Verify admin promotion:
-- SELECT id, email, role FROM public.profiles WHERE email = 'beardbanna07773@gmail.com';

-- 2. Verify all RLS policies on orders:
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'orders' ORDER BY cmd;

-- 3. Verify all RLS policies on order_items:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'order_items' ORDER BY cmd;

-- 4. Verify store_settings policies:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'store_settings' ORDER BY cmd;

-- 5. Verify is_admin() function:
-- SELECT public.is_admin(); -- Should return false when run as anon

-- 6. Count orders (test admin can see all):
-- SELECT COUNT(*) FROM public.orders; -- Should return all orders when signed in as admin
