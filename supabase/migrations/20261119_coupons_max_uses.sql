-- Límite de usos en cupones (dictado del dueño, 2026-11-19).
-- max_uses NULL = ilimitado (comportamiento histórico de todos los
-- cupones existentes: quedan NULL y no cambia nada para ellos).
-- Un «uso» = una venta guardada con ese coupon_id; el conteo se deriva
-- de la tabla sales, sin contador separado que pueda desincronizarse.
-- El código degrada sin romper si esta columna aún no existe (trata
-- todo cupón como ilimitado y reintenta escrituras sin el campo).
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS max_uses INTEGER NULL;

COMMENT ON COLUMN public.coupons.max_uses IS
  'Límite de usos del cupón (NULL = ilimitado). Un uso = una venta con este coupon_id.';
