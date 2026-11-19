-- Historial estructurado de refinanciaciones / reestructuras de pagos
-- (dictado del dueño, 2026-11-19). Cada reestructura de la deuda de una
-- venta (ficha del cliente → Cobranza, solo administrador) deja aquí su
-- registro auditable: cuánto llevaba pagado el cliente, cuánto debía,
-- cuántas cuotas se sustituyeron, el recargo aplicado, el nuevo total
-- y el plan nuevo completo. La línea fechada en sales.notes se conserva
-- como respaldo. La lectura en la app degrada sin romper si esta tabla
-- aún no existe (la ficha simplemente no muestra el historial).
CREATE TABLE IF NOT EXISTS public.sale_refinancings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  customer_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  previous_paid_amount NUMERIC(12, 2) NOT NULL,
  previous_pending_balance NUMERIC(12, 2) NOT NULL,
  replaced_installments INTEGER NOT NULL DEFAULT 0,
  fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  new_total NUMERIC(12, 2) NOT NULL,
  installments_count INTEGER NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  first_due_date DATE NOT NULL,
  installment_amount NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS sale_refinancings_sale_id_idx
  ON public.sale_refinancings (sale_id, created_at DESC);

-- RLS: el personal puede LEER el historial (la ficha lo muestra); las
-- escrituras van por la acción de servidor con cliente admin (service
-- role), que no pasa por estas políticas.
ALTER TABLE public.sale_refinancings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff can read sale refinancings" ON public.sale_refinancings;
CREATE POLICY "staff can read sale refinancings"
  ON public.sale_refinancings
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('super_admin', 'owner', 'optometrist', 'seller'));
