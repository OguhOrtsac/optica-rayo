-- Motivo del descuento de mostrador (dictado del dueño, 2026-11-19):
-- el descuento que el vendedor aplica en el POS (porcentaje o precio
-- final) puede llevar un motivo opcional («Precio de cliente»,
-- «Cumpleaños», «Cliente frecuente»…) que se guarda con la venta y se
-- muestra en el resumen del POS y en el ticket: «Descuento (motivo)».
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_reason TEXT;
