-- ==============================================================================
-- BEARD BANNA — CROSS-DEVICE ORDER SYNCHRONIZATION & CLAIM SYSTEM (v4)
-- ==============================================================================
-- Solves:
--   1. Orders placed on mobile not showing on desktop/laptop.
--   2. Orders placed as guest or before profile UUID was attached.
--   3. One Google Account = One Authenticated Identity = Unified Order History.
--
-- Instructions: Run this script in your Supabase Dashboard:
-- Supabase Dashboard → SQL Editor → New Query → Paste & Run (Ctrl+Enter / Cmd+Enter)
-- ==============================================================================

-- ── 1. Create Indexes for High-Performance Cross-Device Lookup ───────────────
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_lower ON public.orders(LOWER(customer_email));
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- ── 2. RPC: Claim Customer Orders ────────────────────────────────────────────
-- Automatically claims any unlinked orders (user_id IS NULL) that match the
-- authenticated customer's verified email address (from auth.jwt()->>'email').
CREATE OR REPLACE FUNCTION public.claim_customer_orders()
RETURNS INTEGER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_email TEXT := LOWER(TRIM(COALESCE(auth.jwt()->>'email', '')));
    v_claimed INTEGER := 0;
BEGIN
    IF v_user_id IS NULL OR v_email IS NULL OR v_email = '' THEN
        RETURN 0;
    END IF;

    UPDATE public.orders
    SET user_id = v_user_id,
        updated_at = NOW()
    WHERE user_id IS NULL
      AND LOWER(TRIM(customer_email)) = v_email;

    GET DIAGNOSTICS v_claimed = ROW_COUNT;
    RETURN v_claimed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.claim_customer_orders() TO authenticated;

-- ── 3. RPC: Get Customer Orders (Authoritative Server-Side Query) ─────────────
-- Retrieves all orders belonging to the authenticated customer:
-- - Matches auth.uid() = user_id OR LOWER(customer_email) = auth.jwt()->>'email'
-- - Automatically claims any unlinked orders for this email
-- - Aggregates complete order items in a single query
-- - Returns orders sorted newest first (created_at DESC)
CREATE OR REPLACE FUNCTION public.get_customer_orders()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_email TEXT := LOWER(TRIM(COALESCE(auth.jwt()->>'email', '')));
    v_result JSONB;
BEGIN
    -- Guard: Only authenticated users can call this RPC
    IF v_user_id IS NULL AND (v_email IS NULL OR v_email = '') THEN
        RETURN jsonb_build_array();
    END IF;

    -- Auto-claim unlinked orders for this email
    IF v_user_id IS NOT NULL AND v_email <> '' THEN
        UPDATE public.orders
        SET user_id = v_user_id,
            updated_at = NOW()
        WHERE user_id IS NULL
          AND LOWER(TRIM(customer_email)) = v_email;
    END IF;

    -- Aggregate orders with their items
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', o.order_number,
            'orderId', o.order_number,
            '_id', o.id,
            'order_number', o.order_number,
            'user_id', o.user_id,
            'orderDate', o.created_at,
            'created_at', o.created_at,
            'status', o.order_status,
            'order_status', o.order_status,
            'total', o.total,
            'grandTotal', o.total,
            'subtotal', o.subtotal,
            'tax', o.tax,
            'shipping', o.shipping,
            'discount', o.discount,
            'coupon_code', o.coupon_code,
            'payment_method', o.payment_method,
            'payment_status', o.payment_status,
            'razorpay_order_id', o.razorpay_order_id,
            'razorpay_payment_id', o.razorpay_payment_id,
            'customer_name', o.customer_name,
            'customer_email', o.customer_email,
            'customer_phone', o.customer_phone,
            'shipping_address', o.shipping_address,
            'gst_details', o.gst_details,
            'items', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', oi.id,
                        'name', oi.name,
                        'product_id', oi.product_id,
                        'size', oi.size,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'hsn', oi.hsn
                    )
                )
                FROM public.order_items oi
                WHERE oi.order_id = o.id
            ), jsonb_build_array())
        ) ORDER BY o.created_at DESC
    )
    INTO v_result
    FROM public.orders o
    WHERE (v_user_id IS NOT NULL AND o.user_id = v_user_id)
       OR (v_email <> '' AND LOWER(TRIM(o.customer_email)) = v_email)
       OR public.is_admin();

    RETURN COALESCE(v_result, jsonb_build_array());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_customer_orders() TO authenticated;

-- ── 4. Verify & Reinforce Row Level Security Policies ─────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Orders SELECT Policy: Authenticated customers can see orders where:
-- - auth.uid() = user_id
-- - OR customer_email matches their authenticated email token
-- - OR user is an admin
DROP POLICY IF EXISTS "Customers view own orders, admins view all" ON public.orders;
CREATE POLICY "Customers view own orders, admins view all"
    ON public.orders
    FOR SELECT
    USING (
        public.is_admin()
        OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR (auth.uid() IS NOT NULL AND LOWER(TRIM(customer_email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
    );

-- Order Items SELECT Policy:
DROP POLICY IF EXISTS "Users can view order items for own orders" ON public.order_items;
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
                OR (auth.uid() IS NOT NULL AND LOWER(TRIM(o.customer_email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
            )
        )
    );

-- ── 5. Immediate Diagnostic & Auto-Recovery for Order BB92165757 ─────────────
-- Run this block to immediately check status of order BB92165757:
DO $$
DECLARE
    v_ord RECORD;
BEGIN
    SELECT * INTO v_ord FROM public.orders WHERE UPPER(order_number) = 'BB92165757';
    IF FOUND THEN
        RAISE NOTICE '✅ Found Order BB92165757: Customer=%, Email=%, Total=₹%, Status=%, UserID=%',
            v_ord.customer_name, v_ord.customer_email, v_ord.total, v_ord.order_status, v_ord.user_id;
    ELSE
        RAISE NOTICE '⚠️ Order BB92165757 not yet found in Supabase orders table.';
    END IF;
END $$;
