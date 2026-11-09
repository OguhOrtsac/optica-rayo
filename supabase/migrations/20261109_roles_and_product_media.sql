-- Canonical roles + structured product/media fields.
-- Date: 2026-11-09
--
-- Roles:
--   super_admin  = developer/platform team (legacy `dev` remains readable)
--   owner        = business administrator/owner
--   optometrist  = clinical staff (previously mixed into `dev`)
--   seller       = POS/counter staff
--   customer     = registered client/patient
--   guest        = no profile; public catalog only
--
-- Product data moves out of the legacy JSON-in-description pattern into
-- real columns, and product photos become main image + ordered gallery.

-- 1) Expand the profile role check without breaking legacy `dev` rows.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('super_admin', 'dev', 'owner', 'optometrist', 'seller', 'customer'));

COMMENT ON COLUMN public.profiles.role IS
    'Canonical roles: super_admin, owner, optometrist, seller, customer. Legacy dev is an alias of super_admin during migration.';

-- 2) Structured product attributes.
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS brand TEXT,
    ADD COLUMN IF NOT EXISTS material TEXT,
    ADD COLUMN IF NOT EXISTS sku TEXT,
    ADD COLUMN IF NOT EXISTS frame_shape TEXT
        CHECK (frame_shape IS NULL OR frame_shape IN ('round', 'square', 'rectangular', 'aviator', 'cat_eye', 'oval', 'other')),
    ADD COLUMN IF NOT EXISTS color TEXT,
    ADD COLUMN IF NOT EXISTS gallery_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS image_alt TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique
    ON public.products (sku)
    WHERE sku IS NOT NULL AND sku <> '';

COMMENT ON COLUMN public.products.gallery_urls IS
    'Ordered gallery photo URLs. products.image_url remains the main photo.';
COMMENT ON COLUMN public.products.frame_shape IS
    'Frame shape used by the catalog face-shape guide; never infer it from the product name in new records.';

-- Backfill the new columns from valid legacy JSON descriptions only.
-- Invalid legacy text is left untouched and remains readable by the app's
-- backwards-compatible parser.
DO $$
DECLARE
    product_row record;
    legacy jsonb;
BEGIN
    FOR product_row IN
        SELECT id, description
        FROM public.products
        WHERE description IS NOT NULL AND left(btrim(description), 1) = '{'
    LOOP
        BEGIN
            legacy := product_row.description::jsonb;
        EXCEPTION WHEN others THEN
            CONTINUE;
        END;

        UPDATE public.products
        SET
            brand = COALESCE(brand, NULLIF(legacy ->> 'brand', '')),
            material = COALESCE(material, NULLIF(legacy ->> 'material', '')),
            sku = COALESCE(sku, NULLIF(legacy ->> 'sku', ''))
        WHERE id = product_row.id;
    END LOOP;
END $$;

-- 3) Product management is a catalog task for owner/super_admin.
-- Sellers may read products for POS but should not rewrite the catalog.
DROP POLICY IF EXISTS "Allow owner, seller, and dev to manage products" ON public.products;
CREATE POLICY "Allow catalog managers to manage products"
    ON public.products FOR ALL
    USING (public.get_my_role() IN ('super_admin', 'dev', 'owner'))
    WITH CHECK (public.get_my_role() IN ('super_admin', 'dev', 'owner'));

-- 4) Keep the product image bucket aligned with the app standard:
-- public reads, staff writes, image MIME types only, 5 MB per object.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Permitir al staff subir imagenes" ON storage.objects;
CREATE POLICY "Permitir al staff subir imagenes"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'product-images'
        AND (SELECT public.get_my_role()) IN ('super_admin', 'dev', 'owner', 'seller')
    );

DROP POLICY IF EXISTS "Permitir al staff borrar o actualizar imagenes" ON storage.objects;
CREATE POLICY "Permitir al staff borrar o actualizar imagenes"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'product-images'
        AND (SELECT public.get_my_role()) IN ('super_admin', 'dev', 'owner')
    )
    WITH CHECK (
        bucket_id = 'product-images'
        AND (SELECT public.get_my_role()) IN ('super_admin', 'dev', 'owner')
    );

-- 5) App settings remain writable only by business/platform admins.
DROP POLICY IF EXISTS "Allow staff to manage app settings" ON public.app_settings;
CREATE POLICY "Allow staff to manage app settings"
    ON public.app_settings FOR ALL
    USING (public.get_my_role() IN ('super_admin', 'dev', 'owner'))
    WITH CHECK (public.get_my_role() IN ('super_admin', 'dev', 'owner'));
