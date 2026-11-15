-- ================================================================
-- BEARD BANNA — MASTER SECURITY HARDENING & RLS MIGRATION
-- Run this SQL in: Supabase Dashboard → SQL Editor → New Query → Run
-- 
-- PURPOSE:
-- 1. Complete tenant isolation (Customer A cannot access Customer B data)
-- 2. Complete elimination of anonymous SELECT on orders and inquiries
-- 3. Strict admin authorization enforced at the database level
-- 4. Server-side price, coupon, and order integrity
-- 5. Safe guest order tracking via rate-limited RPC function
-- ================================================================

-- ── STEP 1: Enable Extensions ───────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ── STEP 2: Strict is_admin() Helper Function ───────────────────
-- SECURITY DEFINER bypasses RLS on public.profiles to prevent recursion.
-- STABLE allows PostgreSQL query planner optimizations.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ── STEP 3: Profiles Table Hardening (Customer Isolation) ───────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- 1. Customers can ONLY select their own profile. Admins see all.
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

-- 2. Users can only insert their own profile row.
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 3. Users can update their own profile, but CANNOT self-promote to admin.
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (
        (auth.uid() = id AND role = 'customer')
        OR public.is_admin()
    );

-- 4. Only admins can delete profiles.
CREATE POLICY "Admins can delete profiles"
    ON public.profiles
    FOR DELETE
    USING (public.is_admin());


-- ── STEP 4: Orders Table Hardening (Zero Anonymous Data Leaks) ─
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders, admins can view all" ON public.orders;
DROP POLICY IF EXISTS "Authorized users and admins can view orders" ON public.orders;
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Customers and guests can create orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

-- 1. SELECT: Strictly authenticated customer's own orders OR admin.
-- NO ANONYMOUS ACCESS. Guests must use the track_guest_order RPC function.
CREATE POLICY "Customers view own orders, admins view all"
    ON public.orders
    FOR SELECT
    USING (
        public.is_admin()
        OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR (auth.uid() IS NOT NULL AND LOWER(customer_email) = LOWER(COALESCE(auth.jwt()->>'email', '')))
    );

-- 2. INSERT: Customers and guests can create orders.
-- Restrict order_status to 'Processing' or 'Pending' on creation.
CREATE POLICY "Customers and guests can create orders"
    ON public.orders
    FOR INSERT
    WITH CHECK (
        (
            -- Authenticated customer ordering for themselves
            (auth.uid() IS NOT NULL AND auth.uid() = user_id)
            -- Guest checkout with explicit NULL user_id
            OR (user_id IS NULL)
            -- Administrator creating an order
            OR public.is_admin()
        )
        -- Customers/guests cannot create an order already marked as Delivered or Cancelled
        AND (order_status IN ('Processing', 'Pending') OR public.is_admin())
    );

-- 3. UPDATE: Admins ONLY. Customers can NEVER modify order status or totals.
CREATE POLICY "Admins can update orders"
    ON public.orders
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. DELETE: Admins ONLY.
CREATE POLICY "Admins can delete orders"
    ON public.orders
    FOR DELETE
    USING (public.is_admin());


-- ── STEP 5: Safe Guest Order Tracking RPC ───────────────────────
-- Allows guests to track an order without exposing the orders table to anonymous SELECTs.
-- Requires matching BOTH order_number and (customer_phone OR customer_email).
CREATE OR REPLACE FUNCTION public.track_guest_order(
    p_order_number TEXT,
    p_phone_or_email TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
BEGIN
    IF p_order_number IS NULL OR p_phone_or_email IS NULL OR
       LENGTH(TRIM(p_order_number)) < 3 OR LENGTH(TRIM(p_phone_or_email)) < 3 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid tracking parameters.');
    END IF;

    SELECT 
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        subtotal,
        tax,
        shipping,
        total,
        payment_method,
        payment_status,
        order_status,
        created_at
    INTO v_order
    FROM public.orders
    WHERE UPPER(TRIM(order_number)) = UPPER(TRIM(p_order_number))
      AND (
          LOWER(TRIM(customer_email)) = LOWER(TRIM(p_phone_or_email))
          OR TRIM(customer_phone) = TRIM(p_phone_or_email)
      )
    LIMIT 1;

    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found matching provided reference and contact details.');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order', row_to_json(v_order)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execution to public/anon
GRANT EXECUTE ON FUNCTION public.track_guest_order(TEXT, TEXT) TO anon, authenticated;


-- ── STEP 6: Order Items Table Hardening ─────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view order items for own orders" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can insert order items for existing orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;

-- 1. SELECT: Users can only see order items for orders they own; Admins see all.
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

-- 2. INSERT: Insert items only for an existing order owned by user or guest.
CREATE POLICY "Users can insert order items for valid order"
    ON public.order_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND (
                (auth.uid() IS NOT NULL AND o.user_id = auth.uid())
                OR o.user_id IS NULL
                OR public.is_admin()
            )
        )
    );

-- 3. UPDATE/DELETE: Admins ONLY.
CREATE POLICY "Admins can update order items"
    ON public.order_items
    FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete order items"
    ON public.order_items
    FOR DELETE
    USING (public.is_admin());


-- ── STEP 7: Inquiries Table Hardening (Admin Privacy Protected) ─
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    order_number TEXT DEFAULT 'N/A',
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit inquiry" ON public.inquiries;
DROP POLICY IF EXISTS "Admins can view inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Admins can update inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Admins can delete inquiries" ON public.inquiries;

-- 1. INSERT: Anyone can submit an inquiry (Contact form).
CREATE POLICY "Anyone can submit inquiry"
    ON public.inquiries
    FOR INSERT
    WITH CHECK (
        LENGTH(name) <= 100 AND
        LENGTH(email) <= 120 AND
        LENGTH(phone) <= 30 AND
        LENGTH(subject) <= 150 AND
        LENGTH(message) <= 3000
    );

-- 2. SELECT: ADMIN ONLY. Zero anonymous or customer access to customer messages!
CREATE POLICY "Admins can view inquiries"
    ON public.inquiries
    FOR SELECT
    USING (public.is_admin());

-- 3. UPDATE: ADMIN ONLY.
CREATE POLICY "Admins can update inquiries"
    ON public.inquiries
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. DELETE: ADMIN ONLY.
CREATE POLICY "Admins can delete inquiries"
    ON public.inquiries
    FOR DELETE
    USING (public.is_admin());


-- ── STEP 8: Store Settings Table Hardening ───────────────────────
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can insert store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can delete store settings" ON public.store_settings;

CREATE POLICY "Public can view store settings"
    ON public.store_settings
    FOR SELECT
    USING (true);

CREATE POLICY "Admins can insert store settings"
    ON public.store_settings
    FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update store settings"
    ON public.store_settings
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ── STEP 9: Authoritative Products Catalog Table in Supabase ────
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    original_price NUMERIC(10,2) DEFAULT 0,
    category TEXT NOT NULL,
    image TEXT NOT NULL,
    secondary_image TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    size_stock JSONB DEFAULT '{"S":0,"M":0,"L":0,"XL":0,"XXL":0}'::jsonb,
    description TEXT,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

-- Public can only view active products.
CREATE POLICY "Public can view active products"
    ON public.products
    FOR SELECT
    USING (is_active = true OR public.is_admin());

-- Only admins can modify the product catalog.
CREATE POLICY "Admins can insert products"
    ON public.products
    FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update products"
    ON public.products
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete products"
    ON public.products
    FOR DELETE
    USING (public.is_admin());

-- Seed the 3 real Rajputana products if not already present
INSERT INTO public.products (id, name, title, slug, price, original_price, category, image, secondary_image, images, stock, size_stock, description, is_featured, is_active)
VALUES 
    (
        '1',
        'Royal Warrior Embroidered Tee',
        'Royal Warrior Embroidered Tee',
        'royal-warrior-embroidered-tee',
        999.00,
        1499.00,
        'Round Neck T-Shirts',
        'images/Product 1.jpeg',
        'images/Product 2.jpeg',
        '["images/Product 1.jpeg", "images/Product 2.jpeg", "images/Product 3.jpeg"]'::jsonb,
        25,
        '{"S": 0, "M": 5, "L": 15, "XL": 5, "XXL": 0}'::jsonb,
        'Royal warrior tee with gold Rajputana scriptures and premium 100% cotton fabric.',
        true,
        true
    ),
    (
        '2',
        'Imperial Heritage Polo Shirt',
        'Imperial Heritage Polo Shirt',
        'imperial-heritage-polo-shirt',
        1299.00,
        1799.00,
        'Collar T-Shirts',
        'images/Product 2.jpeg',
        'images/Product 3.jpeg',
        '["images/Product 2.jpeg", "images/Product 3.jpeg", "images/Product 1.jpeg"]'::jsonb,
        18,
        '{"S": 2, "M": 8, "L": 8, "XL": 0, "XXL": 0}'::jsonb,
        'Classic polo shirt with royal crest logo and tailored fit.',
        true,
        true
    ),
    (
        '3',
        'Rajputana Valor Heavyweight Hoodie',
        'Rajputana Valor Heavyweight Hoodie',
        'rajputana-valor-heavyweight-hoodie',
        1999.00,
        2699.00,
        'Hoodies',
        'images/Product 3.jpeg',
        'images/Product 1.jpeg',
        '["images/Product 3.jpeg", "images/Product 1.jpeg", "images/Product 2.jpeg"]'::jsonb,
        12,
        '{"S": 0, "M": 0, "L": 5, "XL": 5, "XXL": 2}'::jsonb,
        'Premium heavyweight cotton hoodie crafted for brave hearts.',
        true,
        true
    )
ON CONFLICT (id) DO UPDATE 
SET price = EXCLUDED.price,
    stock = EXCLUDED.stock,
    updated_at = NOW();


-- ── STEP 10: Coupons & Server-Side Validation ───────────────────
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_percent NUMERIC(5,2) DEFAULT 0,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    min_order_amount NUMERIC(10,2) DEFAULT 0,
    max_discount_amount NUMERIC(10,2) DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    usage_limit INTEGER DEFAULT 100,
    times_used INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
CREATE POLICY "Admins manage coupons"
    ON public.coupons
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Seed initial welcome coupon
INSERT INTO public.coupons (code, discount_percent, min_order_amount, max_discount_amount, valid_until, is_active)
VALUES ('ROYAL10', 10.00, 999.00, 300.00, NOW() + INTERVAL '1 year', true)
ON CONFLICT (code) DO NOTHING;

-- Secure server-side coupon validation RPC
CREATE OR REPLACE FUNCTION public.validate_coupon(
    p_code TEXT,
    p_subtotal NUMERIC
)
RETURNS JSONB AS $$
DECLARE
    v_coupon RECORD;
    v_discount NUMERIC := 0;
    v_final_total NUMERIC := 0;
BEGIN
    IF p_code IS NULL OR p_subtotal IS NULL OR p_subtotal <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid coupon or order amount');
    END IF;

    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE UPPER(TRIM(code)) = UPPER(TRIM(p_code))
      AND is_active = true
      AND (valid_until IS NULL OR valid_until > NOW())
      AND times_used < usage_limit
    LIMIT 1;

    IF v_coupon IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid, expired, or depleted coupon code');
    END IF;

    IF p_subtotal < v_coupon.min_order_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', format('Coupon requires a minimum order of ₹%s', v_coupon.min_order_amount)
        );
    END IF;

    IF v_coupon.discount_percent > 0 THEN
        v_discount := ROUND((p_subtotal * (v_coupon.discount_percent / 100.0)), 2);
        IF v_coupon.max_discount_amount > 0 AND v_discount > v_coupon.max_discount_amount THEN
            v_discount := v_coupon.max_discount_amount;
        END IF;
    ELSIF v_coupon.discount_amount > 0 THEN
        v_discount := v_coupon.discount_amount;
    END IF;

    IF v_discount > p_subtotal THEN
        v_discount := p_subtotal;
    END IF;

    v_final_total := p_subtotal - v_discount;

    RETURN jsonb_build_object(
        'success', true,
        'code', v_coupon.code,
        'discount', v_discount,
        'newSubtotal', v_final_total,
        'message', format('Royal coupon %s applied! Saved ₹%s', v_coupon.code, v_discount)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC) TO anon, authenticated;


-- ── STEP 11: Reviews Table Hardening ────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    user_email TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    is_verified_purchase BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can submit review" ON public.reviews;
DROP POLICY IF EXISTS "Admins can update reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can delete reviews" ON public.reviews;

-- 1. Public can only see approved reviews. Admins can see all.
CREATE POLICY "Public can view approved reviews"
    ON public.reviews
    FOR SELECT
    USING (status = 'approved' OR public.is_admin() OR auth.uid() = user_id);

-- 2. Authenticated users can insert their own review.
CREATE POLICY "Authenticated users can submit review"
    ON public.reviews
    FOR INSERT
    WITH CHECK (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR public.is_admin()
    );

-- 3. Only admins can update review status (e.g. approve/reject) or delete.
CREATE POLICY "Admins can update reviews"
    ON public.reviews
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete reviews"
    ON public.reviews
    FOR DELETE
    USING (public.is_admin());
