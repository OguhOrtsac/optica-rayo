-- Migration: Registro de actividad del panel (activity_events)
-- Date: 2026-11-18
--
-- Decisión del dueño (2026-11-18): la sección «Actividad reciente» del
-- panel no debe mostrar solo ventas — debe verse TODA la actividad de
-- la óptica: ventas, exámenes nuevos, clientes nuevos, recordatorios
-- enviados y felicitaciones de cumpleaños.
--
-- Ventas, exámenes y altas de cliente ya viven en sus propias tablas
-- (sales, clinical_exams, profiles) y la actividad las lee de ahí. Pero
-- los recordatorios y las felicitaciones se envían por WhatsApp con un
-- toque (wa.me) y no dejaban rastro en ninguna tabla: esta tabla es ese
-- rastro. El servicio logActivityEvent() inserta una fila en el momento
-- en que el personal toca «WhatsApp» en un recordatorio o «Felicitar»
-- en un cumpleaños; el registro NUNCA bloquea el envío (si la inserción
-- falla, WhatsApp se abre igual y el evento simplemente no queda).
--
-- Semántica:
--  * Una fila = un envío registrado, con su tipo ('reminder_sent' o
--    'birthday_greeting'), el cliente destinatario (nullable: si el
--    cliente se borra después, el evento se conserva con SET NULL),
--    una descripción lista para mostrar («Recordatorio enviado a …»)
--    y quién lo envió (actor_id, nullable con el mismo criterio).
--  * La tabla es de solo anexar: la app inserta y lee lo reciente;
--    no hay edición ni borrado desde la app.
--  * Si la migración aún no se aplica, el servicio degrada en
--    silencio: la lectura devuelve «sin eventos» y la sección sigue
--    funcionando con las demás fuentes (ventas, exámenes, clientes).
--
-- Acceso: la actividad es del staff, así que lectura y registro quedan
-- para owner / seller / dev / super_admin (mismo criterio que las
-- demás tablas operativas, vía public.get_my_role()).

CREATE TABLE IF NOT EXISTS public.activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('reminder_sent', 'birthday_greeting')),
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.activity_events IS
    'Rastro de envíos del panel (recordatorios y felicitaciones por WhatsApp): una fila por envío registrado al tocar el botón. Las demás actividades (ventas, exámenes, altas) se leen de sus propias tablas.';
COMMENT ON COLUMN public.activity_events.type IS
    'Tipo de envío: reminder_sent (recordatorio de revisión) o birthday_greeting (felicitación de cumpleaños).';
COMMENT ON COLUMN public.activity_events.description IS
    'Texto listo para la lista de actividad, p. ej. «Recordatorio enviado a Ana Paula Gutiérrez Mendoza».';

CREATE INDEX IF NOT EXISTS activity_events_created_at_idx
    ON public.activity_events (created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read activity events"
    ON public.activity_events FOR SELECT
    TO authenticated
    USING (public.get_my_role() = ANY (ARRAY['owner', 'seller', 'dev', 'super_admin']));

CREATE POLICY "Staff can create activity events"
    ON public.activity_events FOR INSERT
    TO authenticated
    WITH CHECK (public.get_my_role() = ANY (ARRAY['owner', 'seller', 'dev', 'super_admin']));
