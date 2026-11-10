-- Migration: Promotions — promociones visibles para el cliente
-- Date: 2026-11-09
--
-- Módulo nuevo decidido por el dueño:
--  * Las promociones las crea y administra SOLO el administrador
--    (roles owner / super_admin). El VENDEDOR NO puede crear
--    promociones: solo vende (regla expresa del dueño).
--  * Al cliente le aparecen las promociones VIGENTES (activas y
--    dentro de su ventana de fechas) al iniciar sesión, en su panel.
--  * Las fechas son opcionales: NULL en starts_at/ends_at significa
--    ventana abierta por ese lado.

-- ============================================================
-- 1. PROMOTIONS (Promociones)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    -- Descuento opcional (la promoción puede ser solo informativa).
    discount_percent INTEGER
        CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
    -- Código opcional que el cliente presenta en mostrador.
    code TEXT,
    image_url TEXT,
    starts_at DATE,
    ends_at DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS promotions_active_idx
    ON public.promotions (is_active, created_at DESC);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario AUTENTICADO puede ver las promociones
-- (el cliente las ve en su panel; el staff las ve para operar).
-- El filtrado de vigencia (activa + ventana de fechas) lo aplica
-- el servicio getActivePromotions().
CREATE POLICY "Authenticated users can read promotions"
    ON public.promotions FOR SELECT
    TO authenticated
    USING (true);

-- Alta: solo el administrador (dueño / super_admin). El vendedor
-- NO crea promociones (regla del dueño).
CREATE POLICY "Only admins can create promotions"
    ON public.promotions FOR INSERT
    TO authenticated
    WITH CHECK (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']));

-- Edición (incluye activar/desactivar): solo el administrador.
CREATE POLICY "Only admins can update promotions"
    ON public.promotions FOR UPDATE
    TO authenticated
    USING (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']))
    WITH CHECK (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']));

-- Borrado: solo el administrador.
CREATE POLICY "Only admins can delete promotions"
    ON public.promotions FOR DELETE
    TO authenticated
    USING (public.get_my_role() = ANY (ARRAY['owner', 'super_admin']));

COMMENT ON TABLE public.promotions IS 'Promociones del negocio: las crea solo el administrador (owner/super_admin); el cliente ve las vigentes en su panel.';
COMMENT ON COLUMN public.promotions.discount_percent IS 'Descuento opcional 0-100; NULL = promoción informativa sin descuento.';
COMMENT ON COLUMN public.promotions.code IS 'Código opcional que el cliente presenta en mostrador.';
COMMENT ON COLUMN public.promotions.starts_at IS 'Inicio de vigencia (DATE); NULL = vigente desde ya.';
COMMENT ON COLUMN public.promotions.ends_at IS 'Fin de vigencia (DATE, inclusivo); NULL = sin fecha de término.';
