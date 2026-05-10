-- ============================================================
-- Saathpay — Supabase Schema (Updated)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. USERS (profile / settings for app users — gym/business owners)
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  business_name TEXT DEFAULT 'My Business',
  phone         TEXT,
  business_type TEXT NOT NULL DEFAULT 'gym'
                  CHECK (business_type IN ('gym','yoga','dance')),
  upi_id        TEXT,
  upi_payee_name TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());


-- 2. MEMBERS (owned by a user via tid)
CREATE TABLE IF NOT EXISTS public.members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tid         UUID NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  join_date   DATE DEFAULT CURRENT_DATE,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('paid','overdue','pending','failed')),
  status_label TEXT,
  reminder_start_date DATE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant can view own members" ON public.members;
CREATE POLICY "Tenant can view own members"
  ON public.members FOR SELECT
  USING (tid = auth.uid());

DROP POLICY IF EXISTS "Tenant can insert own members" ON public.members;
CREATE POLICY "Tenant can insert own members"
  ON public.members FOR INSERT
  WITH CHECK (tid = auth.uid());

DROP POLICY IF EXISTS "Tenant can update own members" ON public.members;
CREATE POLICY "Tenant can update own members"
  ON public.members FOR UPDATE
  USING (tid = auth.uid())
  WITH CHECK (tid = auth.uid());

DROP POLICY IF EXISTS "Tenant can delete own members" ON public.members;
CREATE POLICY "Tenant can delete own members"
  ON public.members FOR DELETE
  USING (tid = auth.uid());


-- 3. PAYMENTS (payment records for members, owned by tid)
CREATE TABLE IF NOT EXISTS public.payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tid         UUID NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,
  date        TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('paid','overdue','pending','failed')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant can view own payments" ON public.payments;
CREATE POLICY "Tenant can view own payments"
  ON public.payments FOR SELECT
  USING (tid = auth.uid());

DROP POLICY IF EXISTS "Tenant can insert own payments" ON public.payments;
CREATE POLICY "Tenant can insert own payments"
  ON public.payments FOR INSERT
  WITH CHECK (tid = auth.uid());

DROP POLICY IF EXISTS "Tenant can update own payments" ON public.payments;
CREATE POLICY "Tenant can update own payments"
  ON public.payments FOR UPDATE
  USING (tid = auth.uid())
  WITH CHECK (tid = auth.uid());

DROP POLICY IF EXISTS "Tenant can delete own payments" ON public.payments;
CREATE POLICY "Tenant can delete own payments"
  ON public.payments FOR DELETE
  USING (tid = auth.uid());


-- 4. AUTO-CREATE user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, business_name, phone, business_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business'),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'business_type', 'gym')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- 5. INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_members_tid ON public.members(tid);
CREATE INDEX IF NOT EXISTS idx_payments_tid ON public.payments(tid);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON public.payments(member_id);
