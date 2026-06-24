-- Migration: Clinical History System for Optica Rayo
-- Adds customer_profiles, clinical_exams and extends sales table.

-- ============================================================
-- 1. CUSTOMER PROFILES (datos clínicos extendidos del paciente)
-- ============================================================
CREATE TABLE public.customer_profiles (
    id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    phone TEXT,
    date_of_birth DATE,
    address TEXT,
    occupation TEXT,
    blood_type TEXT CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','NS')),
    medical_notes TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 2. CLINICAL EXAMS (historial de exámenes de la vista)
-- ============================================================
CREATE TABLE public.clinical_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    examiner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    exam_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Ojo Derecho (OD)
    od_sphere NUMERIC(5,2),
    od_cylinder NUMERIC(5,2),
    od_axis INTEGER CHECK (od_axis >= 0 AND od_axis <= 180),
    od_add NUMERIC(5,2),
    od_visual_acuity TEXT,

    -- Ojo Izquierdo (OI)
    oi_sphere NUMERIC(5,2),
    oi_cylinder NUMERIC(5,2),
    oi_axis INTEGER CHECK (oi_axis >= 0 AND oi_axis <= 180),
    oi_add NUMERIC(5,2),
    oi_visual_acuity TEXT,

    -- Datos adicionales
    pd_distance NUMERIC(5,2),
    pd_near NUMERIC(5,2),
    intraocular_pressure_od NUMERIC(5,2),
    intraocular_pressure_oi NUMERIC(5,2),

    lens_type TEXT CHECK (lens_type IN ('monofocal','bifocal','progresivo','contacto','ninguno')),
    frame_recommendation TEXT,
    treatment TEXT,
    clinical_notes TEXT,
    next_exam_date DATE,

    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 3. EXTEND SALES TABLE (link to exam + coupon + discount)
-- ============================================================
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES public.clinical_exams(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS discount_applied NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_exams ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES — customer_profiles
-- ============================================================
CREATE POLICY "Customers can read their own customer_profile"
    ON public.customer_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Customers can update their own customer_profile"
    ON public.customer_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Staff can read all customer_profiles"
    ON public.customer_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

CREATE POLICY "Staff can insert customer_profiles"
    ON public.customer_profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

CREATE POLICY "Owner and dev can update any customer_profile"
    ON public.customer_profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'dev')
        )
    );

-- ============================================================
-- 6. RLS POLICIES — clinical_exams
-- ============================================================
CREATE POLICY "Customers can read their own clinical_exams"
    ON public.clinical_exams FOR SELECT
    USING (auth.uid() = customer_id);

CREATE POLICY "Staff can read all clinical_exams"
    ON public.clinical_exams FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

CREATE POLICY "Staff can insert clinical_exams"
    ON public.clinical_exams FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

CREATE POLICY "Owner and dev can update clinical_exams"
    ON public.clinical_exams FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'dev')
        )
    );

-- ============================================================
-- 7. TRIGGER: auto-create customer_profile row when new customer registers
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_customer_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create customer_profile for role = 'customer'
    IF NEW.role = 'customer' THEN
        INSERT INTO public.customer_profiles (id)
        VALUES (NEW.id)
        ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_customer_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_profile();
