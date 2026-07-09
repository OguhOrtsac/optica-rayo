-- Migration: Lens Materials, Lens Treatments, and Prescription Privacy Toggle
-- Adds catalogs and extends sales/sale_items tables.

-- ============================================================
-- 1. LENS MATERIALS (Materiales de micas y su precio base)
-- ============================================================
CREATE TABLE public.lens_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 2. LENS TREATMENTS (Tratamientos extras globales y sus precios)
-- ============================================================
CREATE TABLE public.lens_treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 3. EXTEND SALE ITEMS TABLE (Lente compuesto)
-- ============================================================
ALTER TABLE public.sale_items
    ADD COLUMN IF NOT EXISTS lens_material_id UUID REFERENCES public.lens_materials(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS lens_material_price NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS od_sphere NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS od_cylinder NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS od_axis INTEGER CHECK (od_axis >= 0 AND od_axis <= 180),
    ADD COLUMN IF NOT EXISTS od_add NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS oi_sphere NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS oi_cylinder NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS oi_axis INTEGER CHECK (oi_axis >= 0 AND oi_axis <= 180),
    ADD COLUMN IF NOT EXISTS oi_add NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS pd_distance NUMERIC(5,2);

-- ============================================================
-- 4. SALE ITEM TREATMENTS (Tratamientos aplicados a cada mica de venta)
-- ============================================================
CREATE TABLE public.sale_item_treatments (
    sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE CASCADE NOT NULL,
    treatment_id UUID REFERENCES public.lens_treatments(id) ON DELETE CASCADE NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    PRIMARY KEY (sale_item_id, treatment_id)
);

-- ============================================================
-- 5. EXTEND SALES TABLE (is_prescription_visible privacy flag)
-- ============================================================
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS is_prescription_visible BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 6. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.lens_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lens_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_item_treatments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- Lens Materials Policies
CREATE POLICY "Allow anyone to read lens materials"
    ON public.lens_materials FOR SELECT
    USING (true);

CREATE POLICY "Allow staff to manage lens materials"
    ON public.lens_materials FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

-- Lens Treatments Policies
CREATE POLICY "Allow anyone to read lens treatments"
    ON public.lens_treatments FOR SELECT
    USING (true);

CREATE POLICY "Allow staff to manage lens treatments"
    ON public.lens_treatments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

-- Sale Item Treatments Policies
CREATE POLICY "Allow customers to view their own sale item treatments"
    ON public.sale_item_treatments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sale_items si
            JOIN public.sales s ON si.sale_id = s.id
            WHERE si.id = sale_item_treatments.sale_item_id
            AND s.customer_id = auth.uid()
        )
    );

CREATE POLICY "Allow staff to view all sale item treatments"
    ON public.sale_item_treatments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

CREATE POLICY "Allow staff to insert sale item treatments"
    ON public.sale_item_treatments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

-- ============================================================
-- 8. SEED DATA (Catálogos iniciales)
-- ============================================================

-- Seed materials
INSERT INTO public.lens_materials (name, price) VALUES
('Resina Básica CR-39', 350.00),
('Policarbonato (Resistente a impactos)', 650.00),
('Alto Índice 1.67 (Extra delgada)', 1290.00),
('Lente de Contacto (Par)', 800.00)
ON CONFLICT DO NOTHING;

-- Seed treatments
INSERT INTO public.lens_treatments (name, price) VALUES
('Antirreflejante Básico', 250.00),
('Filtro Luz Azul (Celular/Computadora)', 450.00),
('Fotocromático Transitions (Cambio con sol)', 950.00),
('Tratamiento Hidrofóbico (Anti-empañante)', 200.00),
('Espejado Estético (Sol)', 400.00)
ON CONFLICT DO NOTHING;
