-- Migration: Fix RLS recursion on profiles table and optimize role checks
-- Fixes "infinite recursion detected in policy for relation profiles" by using a SECURITY DEFINER helper.

-- 1. Create helper function to fetch role avoiding RLS checks (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Drop existing recursive policies on profiles
DROP POLICY IF EXISTS "Allow management roles to view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow dev and owner to delete/update any profile" ON public.profiles;

-- 3. Re-create profiles policies using the helper function
CREATE POLICY "Allow management roles to view all profiles"
    ON public.profiles FOR SELECT
    USING (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

CREATE POLICY "Allow dev and owner to delete/update any profile"
    ON public.profiles FOR ALL
    USING (
        public.get_my_role() IN ('owner', 'dev')
    );

-- 4. Optimize products policies
DROP POLICY IF EXISTS "Allow owner, seller, and dev to manage products" ON public.products;
CREATE POLICY "Allow owner, seller, and dev to manage products"
    ON public.products FOR ALL
    USING (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

-- 5. Optimize sales policies
DROP POLICY IF EXISTS "Allow staff and dev to view all sales" ON public.sales;
DROP POLICY IF EXISTS "Allow staff and dev to create sales" ON public.sales;

CREATE POLICY "Allow staff and dev to view all sales"
    ON public.sales FOR SELECT
    USING (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

CREATE POLICY "Allow staff and dev to create sales"
    ON public.sales FOR INSERT
    WITH CHECK (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

-- 6. Optimize sale_items policies
DROP POLICY IF EXISTS "Allow staff and dev to view all sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Allow staff and dev to insert sale items" ON public.sale_items;

CREATE POLICY "Allow staff and dev to view all sale items"
    ON public.sale_items FOR SELECT
    USING (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

CREATE POLICY "Allow staff and dev to insert sale items"
    ON public.sale_items FOR INSERT
    WITH CHECK (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

-- 7. Optimize coupons policies
DROP POLICY IF EXISTS "Allow staff and dev to manage coupons" ON public.coupons;
CREATE POLICY "Allow staff and dev to manage coupons"
    ON public.coupons FOR ALL
    USING (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

-- 8. Optimize reminders policies
DROP POLICY IF EXISTS "Allow staff and dev to manage reminders" ON public.reminders;
CREATE POLICY "Allow staff and dev to manage reminders"
    ON public.reminders FOR ALL
    USING (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

-- 9. Optimize customer_profiles (from clinical migration) to prevent nested select RLS checks
DROP POLICY IF EXISTS "Staff can read all customer_profiles" ON public.customer_profiles;
DROP POLICY IF EXISTS "Staff can insert customer_profiles" ON public.customer_profiles;
DROP POLICY IF EXISTS "Owner and dev can update any customer_profile" ON public.customer_profiles;

CREATE POLICY "Staff can read all customer_profiles"
    ON public.customer_profiles FOR SELECT
    USING (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

CREATE POLICY "Staff can insert customer_profiles"
    ON public.customer_profiles FOR INSERT
    WITH CHECK (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

CREATE POLICY "Owner and dev can update any customer_profile"
    ON public.customer_profiles FOR UPDATE
    USING (
        public.get_my_role() IN ('owner', 'dev')
    );

-- 10. Optimize clinical_exams policies
DROP POLICY IF EXISTS "Staff can read all clinical_exams" ON public.clinical_exams;
DROP POLICY IF EXISTS "Staff can insert clinical_exams" ON public.clinical_exams;
DROP POLICY IF EXISTS "Owner and dev can update clinical_exams" ON public.clinical_exams;

CREATE POLICY "Staff can read all clinical_exams"
    ON public.clinical_exams FOR SELECT
    USING (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

CREATE POLICY "Staff can insert clinical_exams"
    ON public.clinical_exams FOR INSERT
    WITH CHECK (
        public.get_my_role() IN ('owner', 'seller', 'dev')
    );

CREATE POLICY "Owner and dev can update clinical_exams"
    ON public.clinical_exams FOR UPDATE
    USING (
        public.get_my_role() IN ('owner', 'dev')
    );
