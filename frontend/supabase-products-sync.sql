-- ==============================================================================
-- BEARD BANNA — PRODUCTS CATALOG PERSISTENCE & STORAGE HARDENING (v5)
-- ==============================================================================
-- Solves:
--   1. Products added in admin panel disappearing after refresh.
--   2. Mobile and other devices not seeing newly added products.
--   3. Cross-device catalog synchronization via central Supabase DB.
--   4. Persistent image storage via Supabase Storage bucket.
--   5. Publish / Unpublish (is_active) controls for products.
--
-- Instructions: Run this script in your Supabase Dashboard:
-- Supabase Dashboard → SQL Editor → New Query → Paste & Run (Ctrl+Enter / Cmd+Enter)
-- ==============================================================================

-- ── 1. Create or Verify Central Products Table ─────────────────────────────────
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

-- ── 2. Update is_admin() to Authorize Admin Account ───────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- A. Check verified primary admin emails
  IF LOWER(COALESCE(auth.jwt()->>'email', '')) IN ('beardbanna07773@gmail.com', 'admin@beard-banna.com') THEN
    RETURN TRUE;
  END IF;

  -- B. Check user metadata role
  IF COALESCE(auth.jwt()->'user_metadata'->>'role', '') = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- C. Check profiles table
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Ensure admin profile row exists in public.profiles with role = 'admin'
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, 'Royal Admin', 'admin'
FROM auth.users
WHERE email = 'beardbanna07773@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- ── 3. Enable RLS and Configure Product Policies ──────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage all products" ON public.products;

-- 1. Public can view active/published products; Admins see ALL products
CREATE POLICY "Public can view active products"
    ON public.products
    FOR SELECT
    USING (is_active = true OR public.is_admin());

-- 2. Only Admins can INSERT new products
CREATE POLICY "Admins can insert products"
    ON public.products
    FOR INSERT
    WITH CHECK (public.is_admin());

-- 3. Only Admins can UPDATE products
CREATE POLICY "Admins can update products"
    ON public.products
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. Only Admins can DELETE products
CREATE POLICY "Admins can delete products"
    ON public.products
    FOR DELETE
    USING (public.is_admin());

-- ── 4. Supabase Storage: Public Bucket for Product Images ─────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies: Public can read, Admins can upload and modify
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
CREATE POLICY "Admins can upload product images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'products' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
CREATE POLICY "Admins can update product images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'products' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
CREATE POLICY "Admins can delete product images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'products' AND public.is_admin());

-- ── 5. Authoritative Admin RPC: Upsert Product ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_save_product(
    p_id TEXT,
    p_name TEXT,
    p_title TEXT,
    p_slug TEXT,
    p_price NUMERIC,
    p_original_price NUMERIC,
    p_category TEXT,
    p_image TEXT,
    p_secondary_image TEXT,
    p_images JSONB,
    p_stock INTEGER,
    p_size_stock JSONB,
    p_description TEXT,
    p_is_featured BOOLEAN,
    p_is_active BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_prod RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    INSERT INTO public.products (
        id, name, title, slug, price, original_price, category,
        image, secondary_image, images, stock, size_stock,
        description, is_featured, is_active, updated_at
    ) VALUES (
        p_id, p_name, p_title, p_slug, p_price, p_original_price, p_category,
        p_image, p_secondary_image, p_images, p_stock, p_size_stock,
        p_description, p_is_featured, p_is_active, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        price = EXCLUDED.price,
        original_price = EXCLUDED.original_price,
        category = EXCLUDED.category,
        image = EXCLUDED.image,
        secondary_image = EXCLUDED.secondary_image,
        images = EXCLUDED.images,
        stock = EXCLUDED.stock,
        size_stock = EXCLUDED.size_stock,
        description = EXCLUDED.description,
        is_featured = EXCLUDED.is_featured,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    RETURNING * INTO v_prod;

    RETURN jsonb_build_object('success', true, 'product', row_to_json(v_prod));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_save_product TO authenticated;

-- ── 6. Authoritative Admin RPC: Delete Product ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_product(p_id TEXT)
RETURNS JSONB AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    DELETE FROM public.products WHERE id = p_id;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_delete_product TO authenticated;

-- ── 7. Authoritative Admin RPC: Toggle Publish Status ─────────────────────────
CREATE OR REPLACE FUNCTION public.admin_toggle_product_status(p_id TEXT, p_is_active BOOLEAN)
RETURNS JSONB AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    UPDATE public.products
    SET is_active = p_is_active,
        updated_at = NOW()
    WHERE id = p_id;

    RETURN jsonb_build_object('success', true, 'is_active', p_is_active);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_toggle_product_status TO authenticated;

-- ── 8. Public RPC: Get Active Products (Cross-Device Fast Query) ───────────────
CREATE OR REPLACE FUNCTION public.get_public_products()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(row_to_json(p) ORDER BY p.created_at DESC)
    INTO v_result
    FROM public.products p
    WHERE p.is_active = true OR public.is_admin();

    RETURN COALESCE(v_result, jsonb_build_array());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_public_products TO anon, authenticated;

-- ── 9. Seed the 3 Authentic Rajputana Products if not present ─────────────────
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
        '{"S":0,"M":5,"L":15,"XL":5,"XXL":0}'::jsonb,
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
        '{"S":2,"M":8,"L":8,"XL":0,"XXL":0}'::jsonb,
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
        '{"S":0,"M":0,"L":5,"XL":5,"XXL":2}'::jsonb,
        'Premium cotton hoodie crafted for brave hearts.',
        true,
        true
    )
ON CONFLICT (id) DO NOTHING;

-- Verification Notice
DO $$
DECLARE
    v_cnt INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_cnt FROM public.products;
    RAISE NOTICE '✅ Products setup complete! Total products in central database: %', v_cnt;
END $$;
