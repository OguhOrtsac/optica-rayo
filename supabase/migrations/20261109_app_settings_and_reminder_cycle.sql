-- Exam Review Reminders module support.
-- 1) app_settings: editable key/value configuration for the business
--    (reminder period in months, WhatsApp message template, and future
--    settings such as the member discount percent).
-- 2) reminders.last_reminded_at: audit of when the customer was last
--    contacted, so a reminder is neither lost nor repeated.
-- Date: 2026-11-09

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Settings are business configuration (no secrets): anyone may read them,
-- only staff roles may write them.
CREATE POLICY "Allow anyone to read app settings"
    ON public.app_settings FOR SELECT
    USING (true);

CREATE POLICY "Allow staff to manage app settings"
    ON public.app_settings FOR ALL
    USING (public.get_my_role() IN ('owner', 'seller', 'dev'))
    WITH CHECK (public.get_my_role() IN ('owner', 'seller', 'dev'));

-- Seed the reminder defaults chosen by the owner (configurable, 6 months).
INSERT INTO public.app_settings (key, value) VALUES
    ('reminder_months', '6'),
    ('reminder_template', 'Hola {nombre}, te saludamos de Óptica Rayo. Han pasado {meses} meses desde tu última revisión de la vista y queremos invitarte a realizarte un nuevo examen. Recuerda que el examen es GRATIS y te ayuda a cuidar tu salud visual. ¿Te agendamos una cita? ¡Esperamos verte pronto!')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.reminders
    ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMP WITH TIME ZONE;

COMMENT ON TABLE public.app_settings IS 'Editable business configuration (reminder period/template, member discount, etc.).';
COMMENT ON COLUMN public.reminders.last_reminded_at IS 'When staff last sent this customer a review reminder via WhatsApp.';
