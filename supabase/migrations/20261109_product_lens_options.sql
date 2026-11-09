-- Cuadrilla Opciones (2026-11-09): opciones de lente POR PRODUCTO para el
-- asistente de cotización.
--
-- Decisión del dueño: los recargos que el asistente traía quemados en el
-- código (graduación +$800/+$1,200/+$2,200, extras +$300/+$500/+$1,200)
-- dejan de ser constantes y pasan a ser datos editables en dos niveles:
--
-- 1) lens_option_templates — la PLANTILLA por defecto. El administrador
--    puede renombrar, reprecial, agregar, desactivar o borrar opciones.
--    Se siembra con los valores que el asistente ya mostraba.
-- 2) product_lens_options — las opciones de CADA producto. Al nacer un
--    producto (o al aplicar esta migración) se copian desde la plantilla,
--    pero a partir de ahí son independientes: editar un producto no toca
--    a los demás ni a la plantilla, y editar la plantilla no reescribe
--    los productos ya creados.
--
-- Grupos: 'vision' = graduación (el asistente elige UNA), 'extra' =
-- tratamientos/filtros (el asistente permite VARIAS).
--
-- RLS con el patrón del repo: lectura pública solo de opciones activas;
-- gestión completa solo para staff (owner/seller/dev/super_admin) vía
-- public.get_my_role(). Las políticas FOR ALL del staff también les dan
-- lectura de las inactivas en el panel de administración.

CREATE TABLE IF NOT EXISTS public.lens_option_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grp TEXT NOT NULL CHECK (grp IN ('vision', 'extra')),
    name TEXT NOT NULL,
    price_delta NUMERIC(10, 2) NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_lens_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    grp TEXT NOT NULL CHECK (grp IN ('vision', 'extra')),
    name TEXT NOT NULL,
    price_delta NUMERIC(10, 2) NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_lens_options_product
    ON public.product_lens_options (product_id, grp, sort_order);

ALTER TABLE public.lens_option_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_lens_options ENABLE ROW LEVEL SECURITY;

-- Lens option templates: public reads only the active ones.
DROP POLICY IF EXISTS "Allow public to read active lens option templates" ON public.lens_option_templates;
CREATE POLICY "Allow public to read active lens option templates"
    ON public.lens_option_templates FOR SELECT
    TO public
    USING (is_active = true);

DROP POLICY IF EXISTS "Allow staff to manage lens option templates" ON public.lens_option_templates;
CREATE POLICY "Allow staff to manage lens option templates"
    ON public.lens_option_templates FOR ALL
    USING (public.get_my_role() IN ('owner', 'seller', 'dev', 'super_admin'))
    WITH CHECK (public.get_my_role() IN ('owner', 'seller', 'dev', 'super_admin'));

-- Product lens options: public reads only the active ones.
DROP POLICY IF EXISTS "Allow public to read active product lens options" ON public.product_lens_options;
CREATE POLICY "Allow public to read active product lens options"
    ON public.product_lens_options FOR SELECT
    TO public
    USING (is_active = true);

DROP POLICY IF EXISTS "Allow staff to manage product lens options" ON public.product_lens_options;
CREATE POLICY "Allow staff to manage product lens options"
    ON public.product_lens_options FOR ALL
    USING (public.get_my_role() IN ('owner', 'seller', 'dev', 'super_admin'))
    WITH CHECK (public.get_my_role() IN ('owner', 'seller', 'dev', 'super_admin'));

-- ============================================================
-- Seed: the template starts life with the exact surcharges the
-- quote assistant used to hardcode in app/catalog/page.tsx.
-- ============================================================
INSERT INTO public.lens_option_templates (grp, name, price_delta, sort_order)
SELECT v.grp, v.name, v.price_delta, v.sort_order
FROM (VALUES
    ('vision', 'Sin graduación (Protección básica)', 0, 10),
    ('vision', 'Monofocal (Visión de Lejos o Cerca)', 800, 20),
    ('vision', 'Bifocal', 1200, 30),
    ('vision', 'Progresivo', 2200, 40),
    ('extra', 'Antirreflejante', 300, 10),
    ('extra', 'Filtro de Luz Azul', 500, 20),
    ('extra', 'Fotocromático Transitions', 1200, 30)
) AS v(grp, name, price_delta, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.lens_option_templates);

-- ============================================================
-- Seed: every existing frame/lens product gets its OWN copy of
-- the active template. From this moment each product's options
-- evolve independently. The NOT EXISTS guard keeps the block
-- safe to re-run and never overwrites options already edited.
-- ============================================================
INSERT INTO public.product_lens_options (product_id, grp, name, price_delta, sort_order, is_active)
SELECT p.id, t.grp, t.name, t.price_delta, t.sort_order, t.is_active
FROM public.products p
CROSS JOIN public.lens_option_templates t
WHERE p.category IN ('frames', 'lenses')
  AND t.is_active = true
  AND NOT EXISTS (
      SELECT 1 FROM public.product_lens_options o WHERE o.product_id = p.id
  );

COMMENT ON TABLE public.lens_option_templates IS 'Plantilla editable de opciones de lente (grupos vision/extra) para el asistente de cotización. Editarla NO cambia los productos ya creados.';
COMMENT ON TABLE public.product_lens_options IS 'Opciones de lente propias de cada producto: nacen como copia de la plantilla y después son independientes por producto.';
