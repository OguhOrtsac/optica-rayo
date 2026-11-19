-- El vendedor entra a Productos (dictado del dueño, 2026-11-19):
-- como apoyo del administrador, da de alta productos y cambia
-- precios. El BORRAR productos se queda solo del administrador, y el
-- reorden del catálogo también (eso vive en la app: saveProductsOrder
-- exige isAdminRole).
--
-- La política vigente de escritura es un FOR ALL («Allow catalog
-- managers to manage products», roles super_admin/dev/owner): se
-- sustituye por políticas por operación, para abrir INSERT/UPDATE al
-- vendedor sin abrirle el DELETE. La lectura pública del catálogo no
-- se toca («Allow public select access on products» sigue vigente y
-- cubre también la lectura del personal).

DROP POLICY IF EXISTS "Allow catalog managers to manage products" ON public.products;

CREATE POLICY "Allow catalog managers and seller to insert products"
    ON public.products FOR INSERT
    WITH CHECK (public.get_my_role() IN ('super_admin', 'dev', 'owner', 'seller'));

CREATE POLICY "Allow catalog managers and seller to update products"
    ON public.products FOR UPDATE
    USING (public.get_my_role() IN ('super_admin', 'dev', 'owner', 'seller'))
    WITH CHECK (public.get_my_role() IN ('super_admin', 'dev', 'owner', 'seller'));

CREATE POLICY "Allow catalog managers to delete products"
    ON public.products FOR DELETE
    USING (public.get_my_role() IN ('super_admin', 'dev', 'owner'));
