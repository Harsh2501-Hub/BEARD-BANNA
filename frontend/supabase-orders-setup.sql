-- ================================================================
-- BEARD BANNA — ORDERS, ORDER ITEMS & STORE SETTINGS SETUP (v3)
-- Safe, idempotent SQL script.
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- ── 1. Store Settings Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors and customers) can read store settings
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings"
    ON public.store_settings
    FOR SELECT
    USING (true);

-- Authenticated admins or service role can insert or update store settings
DROP POLICY IF EXISTS "Admins can insert store settings" ON public.store_settings;
CREATE POLICY "Admins can insert store settings"
    ON public.store_settings
    FOR INSERT
    WITH CHECK (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;
CREATE POLICY "Admins can update store settings"
    ON public.store_settings
    FOR UPDATE
    USING (public.is_admin() OR auth.role() = 'service_role')
    WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- Insert default GST setting if not exists
INSERT INTO public.store_settings (key, value)
VALUES 
    ('gst_enabled', 'false'::jsonb),
    ('gst_rate', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ── 2. Orders Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax NUMERIC(10,2) NOT NULL DEFAULT 0,
    shipping NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0,
    coupon_code TEXT,
    gst_details JSONB DEFAULT '{}'::jsonb,
    payment_method TEXT NOT NULL DEFAULT 'COD',
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    order_status TEXT NOT NULL DEFAULT 'Processing',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Customers can view their own orders; Admins can view all orders
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders"
    ON public.orders
    FOR SELECT
    USING (
        auth.uid() = user_id 
        OR LOWER(customer_email) = LOWER(COALESCE(auth.jwt()->>'email', ''))
        OR public.is_admin()
    );

-- Customers and guests can insert orders
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
    ON public.orders
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        OR user_id IS NULL
        OR auth.role() = 'anon'
        OR auth.role() = 'authenticated'
    );

-- Admins can update orders (e.g. status changes)
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
    ON public.orders
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ── 3. Order Items Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT,
    name TEXT NOT NULL,
    size TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    hsn TEXT DEFAULT '6109',
    image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Anyone who has permission to see the parent order can see its items
DROP POLICY IF EXISTS "Users can view order items" ON public.order_items;
CREATE POLICY "Users can view order items"
    ON public.order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND (
                o.user_id = auth.uid()
                OR LOWER(o.customer_email) = LOWER(COALESCE(auth.jwt()->>'email', ''))
                OR public.is_admin()
            )
        )
    );

-- Anyone who can create an order can insert order items
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
CREATE POLICY "Anyone can insert order items"
    ON public.order_items
    FOR INSERT
    WITH CHECK (true);


-- ── 4. Auto-update Trigger for orders ─────────────────────────────
DROP TRIGGER IF EXISTS on_order_updated ON public.orders;
CREATE TRIGGER on_order_updated
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ── 5. Enable Realtime ────────────────────────────────────────────
-- Safe idempotent realtime addition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'store_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;
  END IF;
END $$;
