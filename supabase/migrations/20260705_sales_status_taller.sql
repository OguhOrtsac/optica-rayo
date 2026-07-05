-- Migration to support workshop workflow states (taller status) in the sales table.
-- Date: 2026-07-05

ALTER TABLE public.sales
ADD COLUMN status TEXT NOT NULL DEFAULT 'Cotizacion' CHECK (status IN ('Cotizacion', 'Anticipo_Pagado', 'En_Taller', 'Listo_Entrega', 'Entregado'));

-- Comment on column
COMMENT ON COLUMN public.sales.status IS 'Workshop status of the lab work: Cotizacion, Anticipo_Pagado, En_Taller, Listo_Entrega, Entregado';
