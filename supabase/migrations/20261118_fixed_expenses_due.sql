-- Migration: Pagos fijos con vencimiento (due_day + last_paid_on)
-- Date: 2026-11-18
--
-- Decisión del dueño (2026-11-18): los gastos fijos (renta, luz, agua…)
-- deben avisar cuando toca pagarlos. Para eso cada fijo gana:
--  * due_day      — el día en que toca pagarlo.
--  * last_paid_on — la última fecha en que se registró su pago.
--
-- Semántica de due_day según periodicity:
--  * monthly: día del mes (1-31; si el mes es más corto, se usa su
--    último día). Sin due_day, el servicio asume el día 1.
--  * weekly:  día de la semana, 1 = lunes … 7 = domingo.
--  * yearly:  día del mes (1-31) del mes de aniversario (el mes del
--    alta del fijo, created_at).
--
-- Ambas columnas nacen NULL: los fijos existentes quedan «sin día
-- configurado» y el servicio aplica sus defaults hasta que el dueño
-- capture el día de pago. Registrar un pago (registerFixedPayment en
-- lib/expenses.ts) crea el gasto del día correspondiente y sella
-- last_paid_on con la fecha del pago.

ALTER TABLE public.fixed_expenses
    ADD COLUMN IF NOT EXISTS due_day int,
    ADD COLUMN IF NOT EXISTS last_paid_on date;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fixed_expenses_due_day_range'
          AND conrelid = 'public.fixed_expenses'::regclass
    ) THEN
        ALTER TABLE public.fixed_expenses
            ADD CONSTRAINT fixed_expenses_due_day_range
            CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31));
    END IF;
END $$;

COMMENT ON COLUMN public.fixed_expenses.due_day IS
    'Día de pago: monthly = día del mes 1-31; weekly = 1 (lunes) a 7 (domingo); yearly = día del mes del aniversario. NULL = sin configurar (monthly asume día 1).';
COMMENT ON COLUMN public.fixed_expenses.last_paid_on IS
    'Última fecha en que se registró el pago de este fijo (lo sella registerFixedPayment al crear el gasto del día).';
