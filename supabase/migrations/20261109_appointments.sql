-- Migration: Appointments — agenda de exámenes de la vista gratuitos
-- Date: 2026-11-09
--
-- Módulo nuevo decidido por el dueño:
--  * El visitante/cliente aparta su examen GRATIS desde /agendar
--    (día + horario, con anti doble reserva en la base).
--  * El staff ve la agenda del día en /dashboard/appointments, confirma
--    o cancela (la cancelación exige motivo y ese motivo lo ve el
--    cliente en su panel), y puede agendar por un cliente (la cita
--    nace confirmada: es el recordatorio del propio administrador).
--  * Al crearse una cita de cliente/invitado, el staff recibe una
--    notificación tipo 'appointment' (disparador SECURITY DEFINER,
--    mismo patrón que notify_new_lens_request: un invitado anónimo no
--    puede insertar notificaciones ajenas por RLS, así que la única vía
--    que funciona para invitados es el disparador).

-- ============================================================
-- 1. APPOINTMENTS (Citas de examen)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Cliente registrado (NULL cuando aparta un invitado sin cuenta).
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Datos del invitado (o copia de contacto cuando no hay cuenta).
    guest_name TEXT,
    guest_phone TEXT,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_by TEXT NOT NULL DEFAULT 'guest'
        CHECK (created_by IN ('customer', 'admin', 'guest')),
    -- Motivo de cancelación: lo escribe quien cancela y lo lee el cliente.
    cancel_reason TEXT,
    cancelled_by TEXT CHECK (cancelled_by IN ('customer', 'admin')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Anti doble reserva: un mismo horario solo puede tener UNA cita viva.
-- Las canceladas liberan el horario (quedan fuera del índice parcial).
CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_live_booking_per_slot
    ON public.appointments (scheduled_date, scheduled_time)
    WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS appointments_date_idx
    ON public.appointments (scheduled_date, scheduled_time);

CREATE INDEX IF NOT EXISTS appointments_customer_idx
    ON public.appointments (customer_id);

-- updated_at se mantiene solo, como en el resto del esquema no se usa
-- un disparador genérico, se crea uno local para esta tabla.
CREATE OR REPLACE FUNCTION public.set_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
CREATE TRIGGER appointments_set_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.set_appointments_updated_at();

-- ============================================================
-- 2. NOTIFICATIONS: nuevo tipo 'appointment'
-- ============================================================
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('general', 'payment_reminder', 'lens_request', 'appointment'));

-- ============================================================
-- 3. HORARIO DE LA AGENDA (configurable en app_settings)
-- ============================================================
-- agenda_open_days: 1=lunes ... 6=sábado, 7=domingo (domingo cerrado).
INSERT INTO public.app_settings (key, value) VALUES
    ('agenda_start', '10:00'),
    ('agenda_end', '19:00'),
    ('agenda_slot_minutes', '30'),
    ('agenda_open_days', '1,2,3,4,5,6')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 4. HORARIOS OCUPADOS (lectura pública sin exponer datos)
-- ============================================================
-- La página pública /agendar necesita saber qué horarios están tomados
-- sin poder leer nombres ni teléfonos de nadie: esta función devuelve
-- SOLO las horas ocupadas del día (citas no canceladas).
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_date DATE)
RETURNS TABLE (scheduled_time TIME) AS $$
    SELECT a.scheduled_time
    FROM public.appointments a
    WHERE a.scheduled_date = p_date
      AND a.status <> 'cancelled'
    ORDER BY a.scheduled_time;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_booked_slots(DATE) TO anon, authenticated;

-- ============================================================
-- 5. AVISO AL STAFF CUANDO SE APARTA UNA CITA
-- ============================================================
-- Mismo patrón que notify_new_lens_request (SECURITY DEFINER para
-- poder insertar notificaciones de otros usuarios). No avisa cuando la
-- cita la crea el propio administrador (created_by='admin'): él ya lo
-- sabe, sería ruido en su propia bandeja.
CREATE OR REPLACE FUNCTION public.notify_new_appointment()
RETURNS TRIGGER AS $$
DECLARE
    appt_name TEXT;
    staff_profile RECORD;
BEGIN
    IF NEW.created_by = 'admin' THEN
        RETURN NEW;
    END IF;

    appt_name := NEW.guest_name;
    IF appt_name IS NULL AND NEW.customer_id IS NOT NULL THEN
        SELECT full_name INTO appt_name
        FROM public.profiles
        WHERE id = NEW.customer_id;
    END IF;
    appt_name := COALESCE(appt_name, 'Un cliente');

    FOR staff_profile IN
        SELECT id FROM public.profiles
        WHERE role IN ('owner', 'seller', 'dev', 'super_admin')
    LOOP
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            staff_profile.id,
            'Nueva Cita de Examen',
            'Nueva cita de examen: ' || appt_name || ', ' ||
                to_char(NEW.scheduled_date, 'DD/MM/YYYY') || ' ' ||
                to_char(NEW.scheduled_time, 'HH24:MI'),
            'appointment'
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_appointment_created ON public.appointments;
CREATE TRIGGER on_appointment_created
    AFTER INSERT ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.notify_new_appointment();

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Staff (roles de gestión, incl. super_admin como en las correcciones
-- del 2026-11-09): gestiona toda la agenda.
CREATE POLICY "Staff can manage all appointments"
    ON public.appointments FOR ALL
    USING (public.get_my_role() = ANY (ARRAY['owner', 'seller', 'dev', 'super_admin']))
    WITH CHECK (public.get_my_role() = ANY (ARRAY['owner', 'seller', 'dev', 'super_admin']));

-- Cliente: ve sus propias citas.
CREATE POLICY "Customers can read their own appointments"
    ON public.appointments FOR SELECT
    USING (customer_id = auth.uid());

-- Cliente con sesión: aparta su propia cita.
CREATE POLICY "Customers can book their own appointments"
    ON public.appointments FOR INSERT
    WITH CHECK (customer_id = auth.uid());

-- Cliente: puede actualizar (cancelar) sus propias citas.
CREATE POLICY "Customers can update their own appointments"
    ON public.appointments FOR UPDATE
    USING (customer_id = auth.uid())
    WITH CHECK (customer_id = auth.uid());

-- Invitado sin cuenta: puede apartar (la fila nace sin customer_id).
-- No puede LEER la tabla: la ocupación se consulta con get_booked_slots.
CREATE POLICY "Guests can book appointments"
    ON public.appointments FOR INSERT
    WITH CHECK (customer_id IS NULL AND created_by = 'guest');

COMMENT ON TABLE public.appointments IS 'Citas de examen de la vista (gratuito). Las aparta el cliente/invitado desde /agendar o el staff desde /dashboard/appointments.';
COMMENT ON COLUMN public.appointments.cancel_reason IS 'Motivo de la cancelación; lo escribe quien cancela y el cliente lo ve en su panel.';
