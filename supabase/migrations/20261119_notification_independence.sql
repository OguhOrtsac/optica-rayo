-- Migración: independencia de notificaciones y sello de «ya enviado»
-- (dictado del dueño, 2026-11-19).
--
-- 1) Descartes de cumpleaños PERSONALES: `birthday_dismissals` era
--    global — si alguien quitaba un cumpleaños, desaparecía para todo
--    el personal. Se agrega `user_id` (NULL en las filas viejas): cada
--    quien descarta solo para sí. Las filas heredadas con user_id NULL
--    quedan IGNORADAS por la lectura nueva (decisión asentada: la
--    lectura filtra `.eq('user_id', <usuario actual>)`, así que un
--    descarte viejo global ya no oculta el cumpleaños a nadie).
--
--    Ojo con la llave primaria: era (customer_id, occurrence_year) —
--    con descartes por usuario, dos personas descartando la MISMA
--    ocurrencia chocarían. Se retira esa PK y se sustituye por un
--    índice único sobre (customer_id, occurrence_year, user_id); los
--    NULL del índice único no colisionan entre sí, así que las filas
--    heredadas no estorban y cada usuario tiene como máximo un
--    descarte por ocurrencia.
--
-- 2) Registro de envíos `message_send_log`: hoy NO existe ningún
--    registro de quién envió una felicitación de cumpleaños o un
--    recordatorio de cobro. Esta tabla lo asienta (quién, a qué
--    cliente, de qué venta si aplica, cuándo) para pintar el sello
--    «ya enviado por {nombre}» en el panel y en la ficha. Es de solo
--    anexar desde la app; la lectura degrada a vacío si la tabla aún
--    no existe y el registro NUNCA bloquea el envío por WhatsApp.
--
-- Acceso: el personal (staff) lee e inserta, mismo criterio que
-- `sale_refinancings` (public.get_my_role()).

ALTER TABLE public.birthday_dismissals
  ADD COLUMN IF NOT EXISTS user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.birthday_dismissals.user_id IS
  'Quién descartó el cumpleaños (dictado 2026-11-19): el descarte es personal. NULL = fila heredada del descarte global, ignorada por la lectura nueva.';

ALTER TABLE public.birthday_dismissals
  DROP CONSTRAINT IF EXISTS birthday_dismissals_pkey;

CREATE UNIQUE INDEX IF NOT EXISTS birthday_dismissals_personal_key
  ON public.birthday_dismissals (customer_id, occurrence_year, user_id);

CREATE TABLE IF NOT EXISTS public.message_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('birthday', 'payment_reminder')),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sale_id UUID NULL REFERENCES public.sales(id) ON DELETE SET NULL,
  sent_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_by_name TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_send_log_lookup_idx
  ON public.message_send_log (kind, customer_id, sent_at DESC);

COMMENT ON TABLE public.message_send_log IS
  'Registro de envíos de WhatsApp hechos por el personal (felicitaciones de cumpleaños y recordatorios de cobro): quién lo mandó, a qué cliente y cuándo. Alimenta el sello «ya enviado por …».';

ALTER TABLE public.message_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff can read message sends" ON public.message_send_log;
CREATE POLICY "staff can read message sends"
  ON public.message_send_log
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'owner', 'optometrist', 'seller'));

DROP POLICY IF EXISTS "staff can log message sends" ON public.message_send_log;
CREATE POLICY "staff can log message sends"
  ON public.message_send_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() IN ('super_admin', 'owner', 'optometrist', 'seller'));
