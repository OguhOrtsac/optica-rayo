-- Migration: Expenses — gastos del día y gastos fijos del negocio
-- Date: 2026-11-09
--
-- Módulo nuevo decidido por el dueño:
--  * Además de las ventas del día existen los GASTOS DEL DÍA
--    (compras y consumos fechados: cristales, insumos, limpieza…).
--  * Los GASTOS FIJOS van aparte (renta, luz, agua…): son montos
--    recurrentes con periodicidad, no gastos de una fecha.
--  * Ambos alimentan los reportes por período (semana o rango de
--    fechas): ventas − gastos del día − fijos prorrateados.
--  * Módulo de administración: SOLO owner / super_admin leen y
--    escriben (el vendedor no ve los gastos del negocio).

-- ============================================================
-- 1. EXPENSES (Gastos del día)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    category TEXT NOT NULL DEFAULT 'Otro',
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_date_idx
    ON public.expenses (expense_date DESC, created_at DESC);

-- ============================================================
-- 2. FIXED_EXPENSES (Gastos fijos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    periodicity TEXT NOT NULL DEFAULT 'monthly'
        CHECK (periodicity IN ('weekly', 'monthly', 'yearly')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fixed_expenses_active_idx
    ON public.fixed_expenses (is_active, concept);

-- ============================================================
-- 3. ROW LEVEL SECURITY (solo owner / super_admin, todo CRUD)
-- ============================================================
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read expenses"
    ON public.expenses FOR SELECT
    TO authenticated
    USING (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']));

CREATE POLICY "Only admins can create expenses"
    ON public.expenses FOR INSERT
    TO authenticated
    WITH CHECK (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']));

CREATE POLICY "Only admins can update expenses"
    ON public.expenses FOR UPDATE
    TO authenticated
    USING (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']))
    WITH CHECK (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']));

CREATE POLICY "Only admins can delete expenses"
    ON public.expenses FOR DELETE
    TO authenticated
    USING (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']));

CREATE POLICY "Only admins can read fixed expenses"
    ON public.fixed_expenses FOR SELECT
    TO authenticated
    USING (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']));

CREATE POLICY "Only admins can create fixed expenses"
    ON public.fixed_expenses FOR INSERT
    TO authenticated
    WITH CHECK (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']));

CREATE POLICY "Only admins can update fixed expenses"
    ON public.fixed_expenses FOR UPDATE
    TO authenticated
    USING (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']))
    WITH CHECK (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']));

CREATE POLICY "Only admins can delete fixed expenses"
    ON public.fixed_expenses FOR DELETE
    TO authenticated
    USING (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']));

COMMENT ON TABLE public.expenses IS 'Gastos del día (fechados): compras y consumos del negocio. Solo owner/super_admin.';
COMMENT ON TABLE public.fixed_expenses IS 'Gastos fijos recurrentes (renta, luz, agua) con periodicidad; alimentan el prorrateo de los reportes. Solo owner/super_admin.';
COMMENT ON COLUMN public.fixed_expenses.periodicity IS 'weekly | monthly | yearly — el reporte los convierte a equivalente mensual.';
COMMENT ON COLUMN public.fixed_expenses.is_active IS 'false = pausado: no cuenta en el prorrateo de reportes.';

-- ============================================================
-- 4. SEMILLAS DEMO (datos ficticios para probar el módulo)
-- ============================================================
-- Gastos fijos demo (sin autor registrado).
INSERT INTO public.fixed_expenses (concept, amount, periodicity, is_active, created_by)
VALUES
    ('Renta del local', 6500, 'monthly', true, NULL),
    ('Energía eléctrica', 850, 'monthly', true, NULL),
    ('Agua', 320, 'monthly', true, NULL);

-- Gastos del día demo, fechados relativos a CURRENT_DATE para que
-- siempre caigan dentro de la semana en curso al revisar la app.
INSERT INTO public.expenses (concept, amount, category, expense_date, notes, created_by)
VALUES
    ('Cristales para armazones', 1240, 'Cristales y material', CURRENT_DATE, NULL, NULL),
    ('Insumos de limpieza', 186, 'Limpieza', CURRENT_DATE, 'Fabuloso, suavitel y detergente', NULL),
    ('Solución para lentes de contacto', 540, 'Insumos', CURRENT_DATE - 1, NULL, NULL),
    ('Paquetería de armazones', 230, 'Servicios', CURRENT_DATE - 3, NULL, NULL),
    ('Recarga de material de taller', 415, 'Insumos', CURRENT_DATE - 6, NULL, NULL);
