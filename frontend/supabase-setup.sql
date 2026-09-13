-- ================================================================
-- BEARD BANNA — SUPABASE DATABASE SETUP (v2)
-- Run this SQL in: Supabase Dashboard → SQL Editor → New Query
--
-- SAFE TO RE-RUN: All statements use IF NOT EXISTS / OR REPLACE.
-- If you already ran v1, this adds the new columns and policies.
-- ================================================================


-- ── 1. Profiles Table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    email       TEXT,
    phone       TEXT DEFAULT '',
    avatar_url  TEXT,
    role        TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add avatar_url column if upgrading from v1 (no-op if already exists)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add role column if upgrading from v1 (no-op if already exists)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

-- Add constraint only if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_role_check'
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('customer', 'admin'));
  END IF;
END
$$;

-- Index for fast lookups by email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Index for admin role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

COMMENT ON TABLE public.profiles IS 'Customer profile data linked to Supabase Auth users';
COMMENT ON COLUMN public.profiles.role IS 'customer (default) or admin. Admin is set manually in this table, never from frontend.';


-- ── 2. Enable Row Level Security ─────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ── 3. Helper function for Admin check (prevents RLS recursion) ──
-- SECURITY DEFINER bypasses RLS so querying profiles inside is_admin()
-- will NEVER cause Postgres error 42P17 (infinite recursion).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ── 4. RLS Policies ──────────────────────────────────────────────

-- Drop existing policies to re-create cleanly (idempotent)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Policy: SELECT — users can view own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Policy: SELECT — admins can view all customer profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles
    FOR SELECT
    USING (public.is_admin());

-- Policy: INSERT — users can only create their own profile row
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Policy: UPDATE — users can update their own profile, but customers cannot promote themselves to admin
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
      auth.uid() = id
      AND (role = 'customer' OR public.is_admin())
    );

-- NO DELETE policy — profiles are deleted automatically via ON DELETE CASCADE on auth.users
-- NO public SELECT policy — customer profiles are never publicly readable


-- ── 4. Auto-update updated_at Trigger ────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;

CREATE TRIGGER on_profile_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- ── 5. Auto-create Profile on New User Signup ─────────────────────
-- Fires on every new auth.users row — works for email/password AND Google OAuth.
-- The frontend also creates profiles — this trigger is a safety net for failures.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, avatar_url, role)
    VALUES (
        NEW.id,
        COALESCE(
          NEW.raw_user_meta_data->>'full_name',
          NEW.raw_user_meta_data->>'name',  -- Google OAuth uses 'name'
          ''
        ),
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(
          NEW.raw_user_meta_data->>'avatar_url',
          NEW.raw_user_meta_data->>'picture',  -- Google OAuth uses 'picture'
          NULL
        ),
        'customer'  -- All new users are customers by default
    )
    ON CONFLICT (id) DO NOTHING; -- Safe: won't create duplicates
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- ── 6. Promote a user to Admin ───────────────────────────────────
-- Run this manually in SQL Editor to make a user an admin.
-- Replace the email below with the actual admin email.
-- NEVER do this from frontend code.
--
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'beardbanna07773@gmail.com';


-- ── 7. Verification ──────────────────────────────────────────────
-- Run these after setup to verify everything is correct:

-- Should return your profiles table with all columns:
-- SELECT id, full_name, email, role, avatar_url, created_at FROM public.profiles LIMIT 10;

-- Should return 4 policies (view own, insert own, update own, admins view all):
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';

-- Should confirm RLS is enabled (relrowsecurity = true):
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'profiles';

-- Should confirm trigger exists:
-- SELECT trigger_name, event_manipulation FROM information_schema.triggers
-- WHERE event_object_table = 'users' AND trigger_schema = 'auth';
