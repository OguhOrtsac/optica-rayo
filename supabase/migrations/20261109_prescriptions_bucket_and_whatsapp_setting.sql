-- Cuadrilla Catálogo (2026-11-09): asistente de cotización REAL.
-- 1) lens_requests.prescription_url: ruta (no URL pública) del archivo de
--    receta dentro del bucket privado 'prescriptions'.
-- 2) Bucket privado 'prescriptions' (5 MB, JPG/PNG/WebP/PDF):
--    - el cliente SOLO puede subir dentro de su propia carpeta
--      (<auth.uid>/archivo), patrón "user folder" de Supabase Storage;
--    - el cliente SOLO lee sus propios archivos; el staff lee todos y
--      puede borrar (limpieza). Sin acceso anónimo: un invitado sin sesión
--      no puede subir receta (su solicitud real tampoco existe: lens_requests
--      exige customer_id), así que el flujo de invitado del catálogo le pide
--      iniciar sesión para enviar solicitud + receta.
-- 3) createLensRequest (services) no acepta prescription_url al insertar,
--    así que el catálogo anexa la ruta con un UPDATE posterior: los clientes
--    necesitan una política UPDATE sobre SUS propias solicitudes (hoy solo
--    tienen SELECT/INSERT).
-- 4) Llave 'business_whatsapp' en app_settings: número del negocio para los
--    enlaces wa.me del catálogo. Se crea VACÍA: sin número configurado el
--    catálogo no muestra ningún botón de WhatsApp (antes había un número de
--    relleno quemado en el código). El staff la llena desde la base/panel.

ALTER TABLE public.lens_requests
  ADD COLUMN IF NOT EXISTS prescription_url TEXT;

COMMENT ON COLUMN public.lens_requests.prescription_url IS 'Ruta del archivo de receta en el bucket privado ''prescriptions'' (formato <customer_id>/<archivo>).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prescriptions',
  'prescriptions',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (convention of this repo: DROP IF EXISTS, then CREATE).
DROP POLICY IF EXISTS "Clientes suben su receta en su carpeta" ON storage.objects;
CREATE POLICY "Clientes suben su receta en su carpeta"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'prescriptions'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Clientes leen su propia receta" ON storage.objects;
CREATE POLICY "Clientes leen su propia receta"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'prescriptions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Staff lee las recetas" ON storage.objects;
CREATE POLICY "Staff lee las recetas"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'prescriptions'
    AND (SELECT public.get_my_role()) IN ('owner', 'seller', 'dev', 'super_admin')
  );

DROP POLICY IF EXISTS "Staff borra recetas" ON storage.objects;
CREATE POLICY "Staff borra recetas"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'prescriptions'
    AND (SELECT public.get_my_role()) IN ('owner', 'seller', 'dev', 'super_admin')
  );

-- Customers may update their own lens requests (attach prescription path).
DROP POLICY IF EXISTS "Customers can update their own requests" ON public.lens_requests;
CREATE POLICY "Customers can update their own requests"
  ON public.lens_requests FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- Business WhatsApp number (empty = catalog hides every WhatsApp button).
INSERT INTO public.app_settings (key, value) VALUES
  ('business_whatsapp', '')
ON CONFLICT (key) DO NOTHING;
