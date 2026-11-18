-- Migration: Descartes de cumpleaños del panel (birthday_dismissals)
-- Date: 2026-11-18
--
-- Decisión del dueño (2026-11-18): en la sección «Cumpleaños próximos»
-- del panel, cada cumpleaños lleva dos botones: «Felicitar» (WhatsApp al
-- cliente) y «Eliminar». Eliminar debe ser PERSISTENTE — «que ya no
-- aparezca ahí» — pero descarta solo la ocurrencia actual (la de este
-- ciclo): el cumpleaños del año siguiente vuelve a aparecer solo.
--
-- Semántica:
--  * Una fila = un cumpleaños descartado, identificado por
--    (customer_id, occurrence_year), donde occurrence_year es el año
--    calendario de la ocurrencia que se estaba mostrando (la próxima:
--    si hoy es diciembre y el cumpleaños es a principios de enero, la
--    ocurrencia mostrada es la de enero del año entrante y se descarta
--    con ese año).
--  * La lista del panel filtra las ocurrencias cuyo (customer_id,
--    occurrence_year) exista aquí; la ocurrencia del año siguiente
--    tiene otra llave y reaparece sin tocar esta tabla.
--  * La tabla es de solo anexar: el servicio lee los descartes del
--    ciclo vigente (año actual y siguiente) y registra uno nuevo; no
--    hay edición ni borrado desde la app.
--
-- Acceso: el panel es del staff, así que lectura y registro quedan
-- para owner / seller / dev / super_admin (mismo criterio que las
-- demás tablas operativas, vía public.get_my_role()).

CREATE TABLE IF NOT EXISTS public.birthday_dismissals (
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    occurrence_year INT NOT NULL CHECK (occurrence_year >= 2000 AND occurrence_year <= 2100),
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (customer_id, occurrence_year)
);

COMMENT ON TABLE public.birthday_dismissals IS
    'Cumpleaños descartados desde el panel: una fila por (cliente, año de la ocurrencia). La ocurrencia del año siguiente reaparece sola.';
COMMENT ON COLUMN public.birthday_dismissals.occurrence_year IS
    'Año calendario de la ocurrencia descartada (la próxima ocurrencia mostrada en el panel al momento de descartar).';

ALTER TABLE public.birthday_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read birthday dismissals"
    ON public.birthday_dismissals FOR SELECT
    TO authenticated
    USING (public.get_my_role() = ANY (ARRAY['owner', 'seller', 'dev', 'super_admin']));

CREATE POLICY "Staff can create birthday dismissals"
    ON public.birthday_dismissals FOR INSERT
    TO authenticated
    WITH CHECK (public.get_my_role() = ANY (ARRAY['owner', 'seller', 'dev', 'super_admin']));
